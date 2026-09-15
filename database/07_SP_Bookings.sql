/* ============================================================
   ZomatoClone - Stored Procedures : Table Booking + Hall Booking
   (Birthday / party hall booking bhi isi me)
   ============================================================ */
USE ZomatoCloneDb;
GO

/* XML/STRING_AGG aur indexed views ke liye ye settings ON chahiye.
   sqlcmd default me QUOTED_IDENTIFIER OFF rakhta hai, isliye explicit. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.usp_Table_Save','P')                 IS NOT NULL DROP PROCEDURE dbo.usp_Table_Save;
IF OBJECT_ID('dbo.usp_Table_List','P')                 IS NOT NULL DROP PROCEDURE dbo.usp_Table_List;
IF OBJECT_ID('dbo.usp_TableBooking_CheckAvailability','P') IS NOT NULL DROP PROCEDURE dbo.usp_TableBooking_CheckAvailability;
IF OBJECT_ID('dbo.usp_TableBooking_Create','P')        IS NOT NULL DROP PROCEDURE dbo.usp_TableBooking_Create;
IF OBJECT_ID('dbo.usp_TableBooking_List','P')          IS NOT NULL DROP PROCEDURE dbo.usp_TableBooking_List;
IF OBJECT_ID('dbo.usp_TableBooking_UpdateStatus','P')  IS NOT NULL DROP PROCEDURE dbo.usp_TableBooking_UpdateStatus;
IF OBJECT_ID('dbo.usp_Hall_Save','P')                  IS NOT NULL DROP PROCEDURE dbo.usp_Hall_Save;
IF OBJECT_ID('dbo.usp_Hall_List','P')                  IS NOT NULL DROP PROCEDURE dbo.usp_Hall_List;
IF OBJECT_ID('dbo.usp_Hall_GetById','P')               IS NOT NULL DROP PROCEDURE dbo.usp_Hall_GetById;
IF OBJECT_ID('dbo.usp_Hall_UpdateImage','P')           IS NOT NULL DROP PROCEDURE dbo.usp_Hall_UpdateImage;
IF OBJECT_ID('dbo.usp_HallBooking_CheckAvailability','P') IS NOT NULL DROP PROCEDURE dbo.usp_HallBooking_CheckAvailability;
IF OBJECT_ID('dbo.usp_HallBooking_Quote','P')          IS NOT NULL DROP PROCEDURE dbo.usp_HallBooking_Quote;
IF OBJECT_ID('dbo.usp_HallBooking_Create','P')         IS NOT NULL DROP PROCEDURE dbo.usp_HallBooking_Create;
IF OBJECT_ID('dbo.usp_HallBooking_List','P')           IS NOT NULL DROP PROCEDURE dbo.usp_HallBooking_List;
IF OBJECT_ID('dbo.usp_HallBooking_UpdateStatus','P')   IS NOT NULL DROP PROCEDURE dbo.usp_HallBooking_UpdateStatus;
GO

/* ==================== RESTAURANT TABLES ======================= */
CREATE PROCEDURE dbo.usp_Table_Save
    @TableId      INT          = 0,
    @RestaurantId INT,
    @TableNumber  NVARCHAR(20),
    @SeatCapacity INT          = 4,
    @Location     NVARCHAR(40) = N'Indoor',
    @IsActive     BIT          = 1
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.RestaurantTables
               WHERE RestaurantId = @RestaurantId AND TableNumber = @TableNumber
                 AND TableId <> ISNULL(@TableId, 0))
    BEGIN
        SELECT -1 AS TableId, N'Ye table number pehle se hai.' AS Message;
        RETURN;
    END

    IF @TableId IS NULL OR @TableId = 0
    BEGIN
        INSERT INTO dbo.RestaurantTables (RestaurantId, TableNumber, SeatCapacity, Location, IsActive)
        VALUES (@RestaurantId, @TableNumber, @SeatCapacity, @Location, @IsActive);
        SET @TableId = CAST(SCOPE_IDENTITY() AS INT);
    END
    ELSE
    BEGIN
        UPDATE dbo.RestaurantTables
        SET TableNumber = @TableNumber, SeatCapacity = @SeatCapacity,
            Location = @Location, IsActive = @IsActive
        WHERE TableId = @TableId;
    END

    SELECT @TableId AS TableId, N'Saved' AS Message;
END
GO

CREATE PROCEDURE dbo.usp_Table_List
    @RestaurantId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TableId, RestaurantId, TableNumber, SeatCapacity, Location, IsActive
    FROM   dbo.RestaurantTables
    WHERE  RestaurantId = @RestaurantId
    ORDER BY Location, TableNumber;
END
GO

/* -----------------------------------------------------------------
   usp_TableBooking_CheckAvailability
   Given date + time + guests, kaunsi tables free hain.
   Overlap window = booking time +/- DurationMin.
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_TableBooking_CheckAvailability
    @RestaurantId INT,
    @BookingDate  DATE,
    @BookingTime  TIME(0),
    @GuestCount   INT,
    @DurationMin  INT          = 90,
    @SeatingPref  NVARCHAR(40) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Start TIME(0) = @BookingTime;
    DECLARE @End   TIME(0) = DATEADD(MINUTE, @DurationMin, CAST(@BookingTime AS DATETIME));

    SELECT  t.TableId, t.TableNumber, t.SeatCapacity, t.Location,
            CAST(1 AS BIT) AS IsAvailable
    FROM    dbo.RestaurantTables t
    WHERE   t.RestaurantId = @RestaurantId
      AND   t.IsActive = 1
      AND   t.SeatCapacity >= @GuestCount
      AND  (@SeatingPref IS NULL OR t.Location = @SeatingPref)
      AND   NOT EXISTS
            (SELECT 1
             FROM   dbo.TableBookings tb
             WHERE  tb.TableId = t.TableId
               AND  tb.BookingDate = @BookingDate
               AND  tb.Status IN ('PENDING','CONFIRMED','SEATED')
               AND  tb.BookingTime < @End
               AND  DATEADD(MINUTE, tb.DurationMin, CAST(tb.BookingTime AS DATETIME)) > CAST(@Start AS DATETIME))
    ORDER BY t.SeatCapacity, t.TableNumber;

    /* summary row */
    SELECT COUNT(*) AS AvailableTableCount
    FROM   dbo.RestaurantTables t
    WHERE  t.RestaurantId = @RestaurantId AND t.IsActive = 1
      AND  t.SeatCapacity >= @GuestCount
      AND (@SeatingPref IS NULL OR t.Location = @SeatingPref)
      AND  NOT EXISTS
           (SELECT 1 FROM dbo.TableBookings tb
            WHERE tb.TableId = t.TableId AND tb.BookingDate = @BookingDate
              AND tb.Status IN ('PENDING','CONFIRMED','SEATED')
              AND tb.BookingTime < @End
              AND DATEADD(MINUTE, tb.DurationMin, CAST(tb.BookingTime AS DATETIME)) > CAST(@Start AS DATETIME));
END
GO

/* -----------------------------------------------------------------
   usp_TableBooking_Create
   Table auto-allot hoti hai (smallest fitting free table).
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_TableBooking_Create
    @RestaurantId   INT,
    @UserId         INT,
    @GuestName      NVARCHAR(120),
    @GuestPhone     NVARCHAR(20),
    @BookingDate    DATE,
    @BookingTime    TIME(0),
    @GuestCount     INT,
    @DurationMin    INT           = 90,
    @SeatingPref    NVARCHAR(40)  = NULL,
    @Occasion       NVARCHAR(60)  = NULL,
    @SpecialRequest NVARCHAR(500) = NULL,
    @BookingId      BIGINT        OUTPUT,
    @Message        NVARCHAR(400) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @BookingId = 0;

    IF NOT EXISTS (SELECT 1 FROM dbo.Restaurants
                   WHERE RestaurantId = @RestaurantId AND IsActive = 1 AND HasTableBooking = 1)
    BEGIN
        SET @Message = N'Is restaurant me table booking available nahi hai.';
        RETURN;
    END

    /* past date/time block */
    DECLARE @NowIst DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());
    IF CAST(@BookingDate AS DATETIME) + CAST(@BookingTime AS DATETIME) < CAST(@NowIst AS DATETIME)
    BEGIN
        SET @Message = N'Beeta hua time select nahi kar sakte.';
        RETURN;
    END

    IF @GuestCount < 1 OR @GuestCount > 30
    BEGIN
        SET @Message = N'Guest count 1 se 30 ke beech hona chahiye. Zyada guests ke liye Hall Booking use karo.';
        RETURN;
    END

    DECLARE @End TIME(0) = DATEADD(MINUTE, @DurationMin, CAST(@BookingTime AS DATETIME));

    BEGIN TRAN;

    /* smallest fitting free table lock kar ke uthao */
    DECLARE @TableId INT;

    SELECT TOP 1 @TableId = t.TableId
    FROM   dbo.RestaurantTables t WITH (UPDLOCK, HOLDLOCK)
    WHERE  t.RestaurantId = @RestaurantId
      AND  t.IsActive = 1
      AND  t.SeatCapacity >= @GuestCount
      AND (@SeatingPref IS NULL OR t.Location = @SeatingPref)
      AND  NOT EXISTS
           (SELECT 1 FROM dbo.TableBookings tb
            WHERE tb.TableId = t.TableId AND tb.BookingDate = @BookingDate
              AND tb.Status IN ('PENDING','CONFIRMED','SEATED')
              AND tb.BookingTime < @End
              AND DATEADD(MINUTE, tb.DurationMin, CAST(tb.BookingTime AS DATETIME)) > CAST(@BookingTime AS DATETIME))
    ORDER BY t.SeatCapacity, t.TableId;

    IF @TableId IS NULL
    BEGIN
        ROLLBACK TRAN;
        SET @Message = N'Is time par koi table free nahi hai. Doosra time try karo.';
        RETURN;
    END

    INSERT INTO dbo.TableBookings
        (BookingNumber, RestaurantId, UserId, TableId, GuestName, GuestPhone,
         BookingDate, BookingTime, DurationMin, GuestCount, SeatingPref,
         Occasion, SpecialRequest, Status)
    VALUES
        (N'TEMP', @RestaurantId, @UserId, @TableId, @GuestName, @GuestPhone,
         @BookingDate, @BookingTime, @DurationMin, @GuestCount, @SeatingPref,
         @Occasion, @SpecialRequest, 'PENDING');

    SET @BookingId = CAST(SCOPE_IDENTITY() AS BIGINT);

    UPDATE dbo.TableBookings
    SET    BookingNumber = dbo.fn_NextSequenceNumber(N'TBL', @BookingId)
    WHERE  BookingId = @BookingId;

    COMMIT TRAN;

    SET @Message = N'Table booking request ho gayi. Restaurant confirm karega.';

    SELECT tb.BookingId, tb.BookingNumber, tb.TableId, t.TableNumber, t.Location,
           tb.BookingDate, tb.BookingTime, tb.GuestCount, tb.Status, @Message AS Message
    FROM   dbo.TableBookings tb
    JOIN   dbo.RestaurantTables t ON t.TableId = tb.TableId
    WHERE  tb.BookingId = @BookingId;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_TableBooking_List
    @BookingId     BIGINT       = NULL,
    @UserId        INT          = NULL,
    @RestaurantId  INT          = NULL,
    @Status        NVARCHAR(20) = NULL,
    @FromDate      DATE         = NULL,
    @ToDate        DATE         = NULL,
    @Search        NVARCHAR(80) = NULL,
    @ForEmployeeId INT          = NULL,
    @PageNumber    INT          = 1,
    @PageSize      INT          = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @PageNumber < 1 SET @PageNumber = 1;

    ;WITH Q AS
    (
        SELECT tb.BookingId, tb.BookingNumber, tb.RestaurantId, r.Name AS RestaurantName,
               r.ThumbnailUrl AS RestaurantImage, r.Locality, r.City,
               tb.UserId, u.FullName AS CustomerName, u.Email AS CustomerEmail,
               tb.TableId, t.TableNumber, t.Location AS TableLocation, t.SeatCapacity,
               tb.GuestName, tb.GuestPhone, tb.BookingDate, tb.BookingTime,
               tb.DurationMin, tb.GuestCount, tb.SeatingPref, tb.Occasion,
               tb.SpecialRequest, tb.Status, tb.CreatedAt,
               h.FullName AS HandledBy,
               COUNT(*) OVER() AS TotalCount
        FROM   dbo.TableBookings tb
        JOIN   dbo.Restaurants r ON r.RestaurantId = tb.RestaurantId
        JOIN   dbo.Users u       ON u.UserId       = tb.UserId
        LEFT JOIN dbo.RestaurantTables t ON t.TableId = tb.TableId
        LEFT JOIN dbo.Users h    ON h.UserId       = tb.HandledByUserId
        WHERE (@BookingId    IS NULL OR tb.BookingId    = @BookingId)
          AND (@UserId       IS NULL OR tb.UserId       = @UserId)
          AND (@RestaurantId IS NULL OR tb.RestaurantId = @RestaurantId)
          AND (@Status       IS NULL OR tb.Status       = @Status)
          AND (@FromDate     IS NULL OR tb.BookingDate >= @FromDate)
          AND (@ToDate       IS NULL OR tb.BookingDate <= @ToDate)
          AND (NULLIF(LTRIM(RTRIM(@Search)), N'') IS NULL
               OR tb.BookingNumber LIKE N'%' + @Search + N'%'
               OR tb.GuestName     LIKE N'%' + @Search + N'%'
               OR tb.GuestPhone    LIKE N'%' + @Search + N'%')
          AND (@ForEmployeeId IS NULL
               OR EXISTS (SELECT 1 FROM dbo.RestaurantEmployees re
                          WHERE re.RestaurantId = tb.RestaurantId
                            AND re.UserId = @ForEmployeeId AND re.IsActive = 1))
    )
    SELECT * FROM Q
    ORDER BY BookingDate DESC, BookingTime DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_TableBooking_UpdateStatus
    @BookingId       BIGINT,
    @NewStatus       NVARCHAR(20),
    @HandledByUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Current NVARCHAR(20) = (SELECT Status FROM dbo.TableBookings WHERE BookingId = @BookingId);

    IF @Current IS NULL
    BEGIN
        SELECT 0 AS AffectedRows, N'Booking nahi mili.' AS Message;
        RETURN;
    END

    IF @Current IN ('COMPLETED','CANCELLED','REJECTED')
    BEGIN
        SELECT 0 AS AffectedRows, N'Booking already ' + @Current + N' hai.' AS Message;
        RETURN;
    END

    UPDATE dbo.TableBookings
    SET    Status = @NewStatus,
           HandledByUserId = ISNULL(@HandledByUserId, HandledByUserId),
           UpdatedAt = SYSUTCDATETIME()
    WHERE  BookingId = @BookingId;

    SELECT 1 AS AffectedRows, N'Booking ' + @NewStatus AS Message;
END
GO

/* ============================ HALLS =========================== */
CREATE PROCEDURE dbo.usp_Hall_Save
    @HallId        INT            = 0,
    @RestaurantId  INT,
    @Name          NVARCHAR(120),
    @Description   NVARCHAR(MAX)  = NULL,
    @MinCapacity   INT            = 20,
    @MaxCapacity   INT            = 100,
    @PricePerPlate DECIMAL(10,2)  = 0,
    @BaseRent      DECIMAL(10,2)  = 0,
    @ImageUrl      NVARCHAR(500)  = NULL,
    @GalleryJson   NVARCHAR(MAX)  = NULL,
    @AmenitiesJson NVARCHAR(MAX)  = NULL,
    @HasAC         BIT            = 1,
    @HasParking    BIT            = 1,
    @HasDJ         BIT            = 0,
    @IsActive      BIT            = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRAN;

    IF @HallId IS NULL OR @HallId = 0
    BEGIN
        INSERT INTO dbo.Halls
            (RestaurantId, Name, Description, MinCapacity, MaxCapacity, PricePerPlate,
             BaseRent, ImageUrl, GalleryJson, AmenitiesJson, HasAC, HasParking, HasDJ, IsActive)
        VALUES
            (@RestaurantId, @Name, @Description, @MinCapacity, @MaxCapacity, @PricePerPlate,
             @BaseRent, @ImageUrl, @GalleryJson, @AmenitiesJson, @HasAC, @HasParking, @HasDJ, @IsActive);

        SET @HallId = CAST(SCOPE_IDENTITY() AS INT);
    END
    ELSE
    BEGIN
        UPDATE dbo.Halls
        SET Name = @Name, Description = @Description, MinCapacity = @MinCapacity,
            MaxCapacity = @MaxCapacity, PricePerPlate = @PricePerPlate, BaseRent = @BaseRent,
            ImageUrl = ISNULL(@ImageUrl, ImageUrl),
            GalleryJson = ISNULL(@GalleryJson, GalleryJson),
            AmenitiesJson = ISNULL(@AmenitiesJson, AmenitiesJson),
            HasAC = @HasAC, HasParking = @HasParking, HasDJ = @HasDJ, IsActive = @IsActive
        WHERE HallId = @HallId;
    END

    /* restaurant par hall booking flag on kar do */
    UPDATE dbo.Restaurants SET HasHallBooking = 1 WHERE RestaurantId = @RestaurantId;

    COMMIT TRAN;

    SELECT @HallId AS HallId, N'Saved' AS Message;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Hall_List
    @RestaurantId    INT          = NULL,
    @City            NVARCHAR(80) = NULL,
    @MinGuestCapacity INT         = NULL,
    @MaxBudgetPerPlate DECIMAL(10,2) = NULL,
    @IncludeInactive BIT          = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT h.HallId, h.RestaurantId, r.Name AS RestaurantName, r.Slug AS RestaurantSlug,
           r.Locality, r.City, r.Rating AS RestaurantRating, r.Phone AS RestaurantPhone,
           h.Name, h.Description, h.MinCapacity, h.MaxCapacity,
           h.PricePerPlate, h.BaseRent, h.ImageUrl, h.GalleryJson, h.AmenitiesJson,
           h.HasAC, h.HasParking, h.HasDJ, h.IsActive,
           (SELECT COUNT(*) FROM dbo.HallBookings hb
            WHERE hb.HallId = h.HallId AND hb.Status = 'COMPLETED') AS CompletedEvents
    FROM   dbo.Halls h
    JOIN   dbo.Restaurants r ON r.RestaurantId = h.RestaurantId
    WHERE (@IncludeInactive = 1 OR (h.IsActive = 1 AND r.IsActive = 1))
      AND (@RestaurantId IS NULL OR h.RestaurantId = @RestaurantId)
      AND (@City         IS NULL OR r.City = @City)
      AND (@MinGuestCapacity IS NULL OR h.MaxCapacity >= @MinGuestCapacity)
      AND (@MaxBudgetPerPlate IS NULL OR h.PricePerPlate <= @MaxBudgetPerPlate)
    ORDER BY r.City, r.Name, h.MaxCapacity;
END
GO

CREATE PROCEDURE dbo.usp_Hall_GetById
    @HallId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT h.*, r.Name AS RestaurantName, r.Slug AS RestaurantSlug,
           r.AddressLine, r.Locality, r.City, r.Phone AS RestaurantPhone,
           r.Latitude, r.Longitude, r.Rating AS RestaurantRating
    FROM   dbo.Halls h
    JOIN   dbo.Restaurants r ON r.RestaurantId = h.RestaurantId
    WHERE  h.HallId = @HallId;

    /* aane wale confirmed events - calendar par blocked dates */
    SELECT EventDate, StartTime, EndTime, EventType
    FROM   dbo.HallBookings
    WHERE  HallId = @HallId
      AND  Status IN ('PENDING','CONFIRMED')
      AND  EventDate >= CAST(DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS DATE)
    ORDER BY EventDate, StartTime;
END
GO

CREATE PROCEDURE dbo.usp_Hall_UpdateImage
    @HallId      INT,
    @ImageUrl    NVARCHAR(500) = NULL,
    @GalleryJson NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Halls
    SET    ImageUrl    = ISNULL(@ImageUrl, ImageUrl),
           GalleryJson = ISNULL(@GalleryJson, GalleryJson)
    WHERE  HallId = @HallId;

    SELECT HallId, Name, ImageUrl, GalleryJson FROM dbo.Halls WHERE HallId = @HallId;
END
GO

/* -----------------------------------------------------------------
   usp_HallBooking_CheckAvailability : slot clash check
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_HallBooking_CheckAvailability
    @HallId    INT,
    @EventDate DATE,
    @StartTime TIME(0),
    @EndTime   TIME(0)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Clash INT =
    (
        SELECT COUNT(*)
        FROM   dbo.HallBookings
        WHERE  HallId = @HallId
          AND  EventDate = @EventDate
          AND  Status IN ('PENDING','CONFIRMED')
          AND  StartTime < @EndTime
          AND  EndTime   > @StartTime
    );

    SELECT CASE WHEN @Clash = 0 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS IsAvailable,
           @Clash AS ClashingBookings,
           CASE WHEN @Clash = 0 THEN N'Slot available hai.'
                ELSE N'Is slot par hall already booked hai.' END AS Message;

    /* us din ke busy slots dikha do */
    SELECT StartTime, EndTime, EventType, Status
    FROM   dbo.HallBookings
    WHERE  HallId = @HallId AND EventDate = @EventDate
      AND  Status IN ('PENDING','CONFIRMED')
    ORDER BY StartTime;
END
GO

/* -----------------------------------------------------------------
   usp_HallBooking_Quote : booking se pehle price estimate
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_HallBooking_Quote
    @HallId      INT,
    @GuestCount  INT,
    @CakeRequired BIT          = 0,
    @CakeWeightKg DECIMAL(4,2) = NULL,
    @DecorationTheme NVARCHAR(120) = NULL,
    @CouponCode  NVARCHAR(40)  = NULL,
    @UserId      INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @PPP DECIMAL(10,2), @Rent DECIMAL(10,2), @Min INT, @Max INT, @RestId INT;

    SELECT @PPP = PricePerPlate, @Rent = BaseRent,
           @Min = MinCapacity, @Max = MaxCapacity, @RestId = RestaurantId
    FROM   dbo.Halls WHERE HallId = @HallId AND IsActive = 1;

    IF @PPP IS NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS IsValid, N'Hall nahi mila.' AS Message;
        RETURN;
    END

    IF @GuestCount < @Min OR @GuestCount > @Max
    BEGIN
        SELECT CAST(0 AS BIT) AS IsValid,
               N'Guest count ' + CAST(@Min AS NVARCHAR(10)) + N' se '
               + CAST(@Max AS NVARCHAR(10)) + N' ke beech hona chahiye.' AS Message;
        RETURN;
    END

    DECLARE @PlateAmount DECIMAL(12,2) = @PPP * @GuestCount;
    DECLARE @Decoration DECIMAL(12,2) =
        CASE WHEN NULLIF(LTRIM(RTRIM(@DecorationTheme)), N'') IS NULL THEN 0 ELSE 2500.00 END;
    DECLARE @CakeCharge DECIMAL(12,2) =
        CASE WHEN @CakeRequired = 1 THEN 800.00 * ISNULL(@CakeWeightKg, 1) ELSE 0 END;

    SET @Decoration = @Decoration + @CakeCharge;

    DECLARE @Gross DECIMAL(12,2) = @Rent + @PlateAmount + @Decoration;
    DECLARE @Discount DECIMAL(12,2) = 0;
    DECLARE @CouponMsg NVARCHAR(400) = NULL;

    IF NULLIF(LTRIM(RTRIM(@CouponCode)), N'') IS NOT NULL AND @UserId IS NOT NULL
    BEGIN
        DECLARE @Cp TABLE (IsValid BIT, DiscountAmount DECIMAL(12,2), Message NVARCHAR(400), CouponId INT);

        INSERT INTO @Cp
        EXEC dbo.usp_Coupon_Validate
             @Code = @CouponCode, @UserId = @UserId, @RestaurantId = @RestId,
             @OrderAmount = @Gross, @AppliesTo = 'HALL';

        SELECT @Discount = CASE WHEN IsValid = 1 THEN DiscountAmount ELSE 0 END,
               @CouponMsg = Message
        FROM @Cp;
    END

    DECLARE @Tax DECIMAL(12,2) = CAST(ROUND((@Gross - @Discount) * 0.18, 2) AS DECIMAL(12,2)); -- 18% GST
    DECLARE @Total DECIMAL(12,2) = @Gross - @Discount + @Tax;
    DECLARE @Advance DECIMAL(12,2) = CAST(ROUND(@Total * 0.30, 2) AS DECIMAL(12,2));           -- 30% advance

    SELECT CAST(1 AS BIT) AS IsValid,
           @Rent AS BaseRent, @PPP AS PricePerPlate, @GuestCount AS GuestCount,
           @PlateAmount AS PlateAmount, @Decoration AS DecorationCharge,
           @CakeCharge AS CakeCharge, @Gross AS GrossAmount,
           @Discount AS DiscountAmount, @Tax AS TaxAmount,
           @Total AS TotalAmount, @Advance AS AdvancePayable,
           ISNULL(@CouponMsg, N'Quote ready.') AS Message;
END
GO

/* -----------------------------------------------------------------
   usp_HallBooking_Create
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_HallBooking_Create
    @HallId          INT,
    @UserId          INT,
    @EventType       NVARCHAR(60),
    @ContactName     NVARCHAR(120),
    @ContactPhone    NVARCHAR(20),
    @EventDate       DATE,
    @StartTime       TIME(0),
    @EndTime         TIME(0),
    @GuestCount      INT,
    @DecorationTheme NVARCHAR(120)  = NULL,
    @CakeRequired    BIT            = 0,
    @CakeFlavour     NVARCHAR(80)   = NULL,
    @CakeWeightKg    DECIMAL(4,2)   = NULL,
    @MenuPreference  NVARCHAR(200)  = NULL,
    @SpecialRequest  NVARCHAR(1000) = NULL,
    @CouponCode      NVARCHAR(40)   = NULL,
    @BookingId       BIGINT         OUTPUT,
    @Message         NVARCHAR(400)  OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @BookingId = 0;

    DECLARE @RestId INT, @Min INT, @Max INT, @PPP DECIMAL(10,2), @Rent DECIMAL(10,2);

    SELECT @RestId = h.RestaurantId, @Min = h.MinCapacity, @Max = h.MaxCapacity,
           @PPP = h.PricePerPlate, @Rent = h.BaseRent
    FROM   dbo.Halls h
    JOIN   dbo.Restaurants r ON r.RestaurantId = h.RestaurantId AND r.IsActive = 1
    WHERE  h.HallId = @HallId AND h.IsActive = 1;

    IF @RestId IS NULL
    BEGIN
        SET @Message = N'Hall available nahi hai.';
        RETURN;
    END

    IF @EndTime <= @StartTime
    BEGIN
        SET @Message = N'End time, start time se baad hona chahiye.';
        RETURN;
    END

    IF @EventDate < CAST(DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS DATE)
    BEGIN
        SET @Message = N'Beeti hui date par booking nahi ho sakti.';
        RETURN;
    END

    IF @GuestCount < @Min OR @GuestCount > @Max
    BEGIN
        SET @Message = N'Guest count ' + CAST(@Min AS NVARCHAR(10)) + N'-'
                     + CAST(@Max AS NVARCHAR(10)) + N' ke beech hona chahiye.';
        RETURN;
    END

    BEGIN TRAN;

    /* slot clash check (lock ke saath) */
    IF EXISTS (SELECT 1 FROM dbo.HallBookings WITH (UPDLOCK, HOLDLOCK)
               WHERE HallId = @HallId AND EventDate = @EventDate
                 AND Status IN ('PENDING','CONFIRMED')
                 AND StartTime < @EndTime AND EndTime > @StartTime)
    BEGIN
        ROLLBACK TRAN;
        SET @Message = N'Ye slot already booked hai. Doosra time choose karo.';
        RETURN;
    END

    /* pricing */
    DECLARE @PlateAmount DECIMAL(12,2) = @PPP * @GuestCount;
    DECLARE @Decoration DECIMAL(12,2) =
        CASE WHEN NULLIF(LTRIM(RTRIM(@DecorationTheme)), N'') IS NULL THEN 0 ELSE 2500.00 END
      + CASE WHEN @CakeRequired = 1 THEN 800.00 * ISNULL(@CakeWeightKg, 1) ELSE 0 END;

    DECLARE @Gross DECIMAL(12,2) = @Rent + @PlateAmount + @Decoration;
    DECLARE @Discount DECIMAL(12,2) = 0;
    DECLARE @CouponId INT = NULL;

    IF NULLIF(LTRIM(RTRIM(@CouponCode)), N'') IS NOT NULL
    BEGIN
        DECLARE @Cp TABLE (IsValid BIT, DiscountAmount DECIMAL(12,2), Message NVARCHAR(400), CouponId INT);

        INSERT INTO @Cp
        EXEC dbo.usp_Coupon_Validate
             @Code = @CouponCode, @UserId = @UserId, @RestaurantId = @RestId,
             @OrderAmount = @Gross, @AppliesTo = 'HALL';

        IF EXISTS (SELECT 1 FROM @Cp WHERE IsValid = 1)
            SELECT @Discount = DiscountAmount, @CouponId = CouponId FROM @Cp;
    END

    DECLARE @Tax DECIMAL(12,2) = CAST(ROUND((@Gross - @Discount) * 0.18, 2) AS DECIMAL(12,2));
    DECLARE @Total DECIMAL(12,2) = @Gross - @Discount + @Tax;

    INSERT INTO dbo.HallBookings
        (BookingNumber, HallId, RestaurantId, UserId, EventType, ContactName, ContactPhone,
         EventDate, StartTime, EndTime, GuestCount, DecorationTheme, CakeRequired,
         CakeFlavour, CakeWeightKg, MenuPreference, SpecialRequest,
         BaseRent, PlateAmount, DecorationCharge, DiscountAmount, TaxAmount,
         TotalAmount, CouponCode, Status, PaymentStatus)
    VALUES
        (N'TEMP', @HallId, @RestId, @UserId, @EventType, @ContactName, @ContactPhone,
         @EventDate, @StartTime, @EndTime, @GuestCount, @DecorationTheme, @CakeRequired,
         @CakeFlavour, @CakeWeightKg, @MenuPreference, @SpecialRequest,
         @Rent, @PlateAmount, @Decoration, @Discount, @Tax,
         @Total, @CouponCode, 'PENDING', 'PENDING');

    SET @BookingId = CAST(SCOPE_IDENTITY() AS BIGINT);

    UPDATE dbo.HallBookings
    SET    BookingNumber = dbo.fn_NextSequenceNumber(N'HALL', @BookingId)
    WHERE  BookingId = @BookingId;

    IF @CouponId IS NOT NULL
    BEGIN
        INSERT INTO dbo.CouponUsages (CouponId, UserId, Amount)
        VALUES (@CouponId, @UserId, @Discount);

        UPDATE dbo.Coupons SET UsedCount = UsedCount + 1 WHERE CouponId = @CouponId;
    END

    COMMIT TRAN;

    SET @Message = N'Hall booking request ho gayi. 30% advance pay karke confirm karo.';

    SELECT BookingId, BookingNumber, HallId, EventType, EventDate, StartTime, EndTime,
           GuestCount, BaseRent, PlateAmount, DecorationCharge, DiscountAmount,
           TaxAmount, TotalAmount,
           CAST(ROUND(TotalAmount * 0.30, 2) AS DECIMAL(12,2)) AS AdvancePayable,
           Status, PaymentStatus, @Message AS Message
    FROM   dbo.HallBookings WHERE BookingId = @BookingId;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_HallBooking_List
    @BookingId     BIGINT       = NULL,
    @UserId        INT          = NULL,
    @RestaurantId  INT          = NULL,
    @HallId        INT          = NULL,
    @Status        NVARCHAR(20) = NULL,
    @EventType     NVARCHAR(60) = NULL,
    @FromDate      DATE         = NULL,
    @ToDate        DATE         = NULL,
    @Search        NVARCHAR(80) = NULL,
    @ForEmployeeId INT          = NULL,
    @PageNumber    INT          = 1,
    @PageSize      INT          = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @PageNumber < 1 SET @PageNumber = 1;

    ;WITH Q AS
    (
        SELECT hb.BookingId, hb.BookingNumber, hb.HallId, h.Name AS HallName, h.ImageUrl AS HallImage,
               hb.RestaurantId, r.Name AS RestaurantName, r.Locality, r.City,
               hb.UserId, u.FullName AS CustomerName, u.Email AS CustomerEmail,
               hb.EventType, hb.ContactName, hb.ContactPhone,
               hb.EventDate, hb.StartTime, hb.EndTime, hb.GuestCount,
               hb.DecorationTheme, hb.CakeRequired, hb.CakeFlavour, hb.CakeWeightKg,
               hb.MenuPreference, hb.SpecialRequest,
               hb.BaseRent, hb.PlateAmount, hb.DecorationCharge, hb.DiscountAmount,
               hb.TaxAmount, hb.TotalAmount, hb.AdvanceAmount, hb.CouponCode,
               hb.Status, hb.PaymentStatus, hb.CreatedAt,
               hu.FullName AS HandledBy,
               COUNT(*) OVER() AS TotalCount
        FROM   dbo.HallBookings hb
        JOIN   dbo.Halls h       ON h.HallId       = hb.HallId
        JOIN   dbo.Restaurants r ON r.RestaurantId = hb.RestaurantId
        JOIN   dbo.Users u       ON u.UserId       = hb.UserId
        LEFT JOIN dbo.Users hu   ON hu.UserId      = hb.HandledByUserId
        WHERE (@BookingId    IS NULL OR hb.BookingId    = @BookingId)
          AND (@UserId       IS NULL OR hb.UserId       = @UserId)
          AND (@RestaurantId IS NULL OR hb.RestaurantId = @RestaurantId)
          AND (@HallId       IS NULL OR hb.HallId       = @HallId)
          AND (@Status       IS NULL OR hb.Status       = @Status)
          AND (@EventType    IS NULL OR hb.EventType    = @EventType)
          AND (@FromDate     IS NULL OR hb.EventDate   >= @FromDate)
          AND (@ToDate       IS NULL OR hb.EventDate   <= @ToDate)
          AND (NULLIF(LTRIM(RTRIM(@Search)), N'') IS NULL
               OR hb.BookingNumber LIKE N'%' + @Search + N'%'
               OR hb.ContactName   LIKE N'%' + @Search + N'%'
               OR hb.ContactPhone  LIKE N'%' + @Search + N'%')
          AND (@ForEmployeeId IS NULL
               OR EXISTS (SELECT 1 FROM dbo.RestaurantEmployees re
                          WHERE re.RestaurantId = hb.RestaurantId
                            AND re.UserId = @ForEmployeeId AND re.IsActive = 1))
    )
    SELECT * FROM Q
    ORDER BY EventDate DESC, StartTime DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_HallBooking_UpdateStatus
    @BookingId       BIGINT,
    @NewStatus       NVARCHAR(20),
    @HandledByUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Current NVARCHAR(20) = (SELECT Status FROM dbo.HallBookings WHERE BookingId = @BookingId);

    IF @Current IS NULL
    BEGIN
        SELECT 0 AS AffectedRows, N'Booking nahi mili.' AS Message;
        RETURN;
    END

    IF @Current IN ('COMPLETED','CANCELLED','REJECTED')
    BEGIN
        SELECT 0 AS AffectedRows, N'Booking already ' + @Current + N' hai.' AS Message;
        RETURN;
    END

    UPDATE dbo.HallBookings
    SET    Status = @NewStatus,
           PaymentStatus = CASE WHEN @NewStatus IN ('CANCELLED','REJECTED') AND PaymentStatus = 'PAID'
                                THEN 'REFUNDED' ELSE PaymentStatus END,
           HandledByUserId = ISNULL(@HandledByUserId, HandledByUserId),
           UpdatedAt = SYSUTCDATETIME()
    WHERE  BookingId = @BookingId;

    SELECT 1 AS AffectedRows, N'Booking ' + @NewStatus AS Message;
END
GO

PRINT 'Booking stored procedures created.';
GO
