/* ============================================================
   ZomatoClone - Stored Procedures : Orders / Coupons / Payments
   ============================================================ */
USE ZomatoCloneDb;
GO

/* XML/STRING_AGG aur indexed views ke liye ye settings ON chahiye.
   sqlcmd default me QUOTED_IDENTIFIER OFF rakhta hai, isliye explicit. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.usp_Coupon_Validate','P')        IS NOT NULL DROP PROCEDURE dbo.usp_Coupon_Validate;
IF OBJECT_ID('dbo.usp_Coupon_ListActive','P')      IS NOT NULL DROP PROCEDURE dbo.usp_Coupon_ListActive;
IF OBJECT_ID('dbo.usp_Coupon_Save','P')            IS NOT NULL DROP PROCEDURE dbo.usp_Coupon_Save;
IF OBJECT_ID('dbo.usp_Coupon_ListForAdmin','P')    IS NOT NULL DROP PROCEDURE dbo.usp_Coupon_ListForAdmin;
IF OBJECT_ID('dbo.usp_Coupon_ToggleActive','P')    IS NOT NULL DROP PROCEDURE dbo.usp_Coupon_ToggleActive;
IF OBJECT_ID('dbo.usp_Order_Create','P')           IS NOT NULL DROP PROCEDURE dbo.usp_Order_Create;
IF OBJECT_ID('dbo.usp_Order_GetById','P')          IS NOT NULL DROP PROCEDURE dbo.usp_Order_GetById;
IF OBJECT_ID('dbo.usp_Order_List','P')             IS NOT NULL DROP PROCEDURE dbo.usp_Order_List;
IF OBJECT_ID('dbo.usp_Order_UpdateStatus','P')     IS NOT NULL DROP PROCEDURE dbo.usp_Order_UpdateStatus;
IF OBJECT_ID('dbo.usp_Order_AssignDelivery','P')   IS NOT NULL DROP PROCEDURE dbo.usp_Order_AssignDelivery;
IF OBJECT_ID('dbo.usp_Payment_Create','P')         IS NOT NULL DROP PROCEDURE dbo.usp_Payment_Create;
IF OBJECT_ID('dbo.usp_Payment_Complete','P')       IS NOT NULL DROP PROCEDURE dbo.usp_Payment_Complete;
IF OBJECT_ID('dbo.usp_Payment_List','P')           IS NOT NULL DROP PROCEDURE dbo.usp_Payment_List;
GO

/* =========================== COUPONS ========================== */

/* -----------------------------------------------------------------
   usp_Coupon_Validate
   Ek hi result set: IsValid, DiscountAmount, Message, CouponId.
   Saare reject reasons @Error me collect hote hain aur end me ek hi
   SELECT chalti hai - isse column names har case me same rehte hain.
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Coupon_Validate
    @Code         NVARCHAR(40),
    @UserId       INT,
    @RestaurantId INT           = NULL,
    @OrderAmount  DECIMAL(12,2),
    @AppliesTo    NVARCHAR(20)  = 'ORDER'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CouponId    INT,
            @Type        NVARCHAR(10),
            @Value       DECIMAL(10,2),
            @MaxDiscount DECIMAL(10,2),
            @MinOrder    DECIMAL(10,2),
            @RestId      INT,
            @UsageLimit  INT,
            @PerUser     INT,
            @UsedCount   INT,
            @ValidFrom   DATETIME2(0),
            @ValidTo     DATETIME2(0),
            @CpAppliesTo NVARCHAR(20);

    SELECT @CouponId = CouponId, @Type = DiscountType, @Value = DiscountValue,
           @MaxDiscount = MaxDiscountAmount, @MinOrder = MinOrderAmount,
           @RestId = RestaurantId, @UsageLimit = UsageLimit,
           @PerUser = UsageLimitPerUser, @UsedCount = UsedCount,
           @ValidFrom = ValidFrom, @ValidTo = ValidTo, @CpAppliesTo = AppliesTo
    FROM   dbo.Coupons
    WHERE  Code = @Code AND IsActive = 1;

    DECLARE @Error NVARCHAR(400) = NULL;
    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();

    IF @CouponId IS NULL
        SET @Error = N'Coupon code galat hai.';

    ELSE IF @Now > @ValidTo
        SET @Error = N'Ye coupon expire ho gaya hai.';

    ELSE IF @Now < @ValidFrom
        SET @Error = N'Ye coupon abhi shuru nahi hua.';

    ELSE IF @CpAppliesTo <> @AppliesTo
        SET @Error = N'Ye coupon is type ki booking par valid nahi hai.';

    ELSE IF @RestId IS NOT NULL AND @RestaurantId IS NOT NULL AND @RestId <> @RestaurantId
        SET @Error = N'Ye coupon is restaurant par valid nahi hai.';

    ELSE IF @OrderAmount < @MinOrder
        SET @Error = N'Minimum order amount Rs '
                   + CAST(CAST(@MinOrder AS INT) AS NVARCHAR(20)) + N' honi chahiye.';

    ELSE IF @UsageLimit IS NOT NULL AND @UsedCount >= @UsageLimit
        SET @Error = N'Coupon ki limit khatam ho gayi.';

    ELSE IF @PerUser IS NOT NULL
        AND (SELECT COUNT(*) FROM dbo.CouponUsages
             WHERE CouponId = @CouponId AND UserId = @UserId) >= @PerUser
        SET @Error = N'Aap ye coupon pehle hi use kar chuke hain.';

    /* ---------- reject ---------- */
    IF @Error IS NOT NULL
    BEGIN
        SELECT CAST(0 AS BIT)           AS IsValid,
               CAST(0 AS DECIMAL(12,2)) AS DiscountAmount,
               @Error                   AS Message,
               @CouponId                AS CouponId;
        RETURN;
    END

    /* ---------- accept: discount calculate ---------- */
    DECLARE @Discount DECIMAL(12,2) =
        CASE WHEN @Type = 'PERCENT' THEN ROUND(@OrderAmount * @Value / 100.0, 2)
             ELSE @Value
        END;

    IF @MaxDiscount IS NOT NULL AND @Discount > @MaxDiscount SET @Discount = @MaxDiscount;
    IF @Discount > @OrderAmount SET @Discount = @OrderAmount;

    SELECT CAST(1 AS BIT) AS IsValid,
           @Discount      AS DiscountAmount,
           N'Coupon apply ho gaya! Rs ' + CAST(CAST(@Discount AS INT) AS NVARCHAR(20))
             + N' bachat.' AS Message,
           @CouponId      AS CouponId;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Coupon_ListActive
    @RestaurantId INT          = NULL,
    @AppliesTo    NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT CouponId, Code, Title, Description, DiscountType, DiscountValue,
           MaxDiscountAmount, MinOrderAmount, RestaurantId, AppliesTo, ValidFrom, ValidTo
    FROM   dbo.Coupons
    WHERE  IsActive = 1
      AND  SYSUTCDATETIME() BETWEEN ValidFrom AND ValidTo
      AND (@RestaurantId IS NULL OR RestaurantId IS NULL OR RestaurantId = @RestaurantId)
      AND (@AppliesTo    IS NULL OR AppliesTo = @AppliesTo)
      AND (UsageLimit IS NULL OR UsedCount < UsageLimit)
    ORDER BY CASE WHEN RestaurantId = @RestaurantId THEN 0 ELSE 1 END, DiscountValue DESC;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Coupon_Save
    @CouponId          INT           = 0,
    @Code              NVARCHAR(40),
    @Title             NVARCHAR(150),
    @Description       NVARCHAR(400) = NULL,
    @DiscountType      NVARCHAR(10),
    @DiscountValue     DECIMAL(10,2),
    @MaxDiscountAmount DECIMAL(10,2) = NULL,
    @MinOrderAmount    DECIMAL(10,2) = 0,
    @RestaurantId      INT           = NULL,
    @AppliesTo         NVARCHAR(20)  = 'ORDER',
    @ValidFrom         DATETIME2(0),
    @ValidTo           DATETIME2(0),
    @UsageLimit        INT           = NULL,
    @UsageLimitPerUser INT           = NULL,
    @IsActive          BIT           = 1
AS
BEGIN
    SET NOCOUNT ON;

    SET @Code = UPPER(LTRIM(RTRIM(@Code)));

    IF EXISTS (SELECT 1 FROM dbo.Coupons
               WHERE Code = @Code AND CouponId <> ISNULL(@CouponId, 0))
    BEGIN
        SELECT -1 AS CouponId, N'Ye coupon code pehle se maujood hai.' AS Message;
        RETURN;
    END

    IF @CouponId IS NULL OR @CouponId = 0
    BEGIN
        INSERT INTO dbo.Coupons
            (Code, Title, Description, DiscountType, DiscountValue, MaxDiscountAmount,
             MinOrderAmount, RestaurantId, AppliesTo, ValidFrom, ValidTo,
             UsageLimit, UsageLimitPerUser, IsActive)
        VALUES
            (@Code, @Title, @Description, @DiscountType, @DiscountValue, @MaxDiscountAmount,
             @MinOrderAmount, @RestaurantId, @AppliesTo, @ValidFrom, @ValidTo,
             @UsageLimit, @UsageLimitPerUser, @IsActive);

        SET @CouponId = CAST(SCOPE_IDENTITY() AS INT);
    END
    ELSE
    BEGIN
        UPDATE dbo.Coupons
        SET Code = @Code, Title = @Title, Description = @Description,
            DiscountType = @DiscountType, DiscountValue = @DiscountValue,
            MaxDiscountAmount = @MaxDiscountAmount, MinOrderAmount = @MinOrderAmount,
            RestaurantId = @RestaurantId, AppliesTo = @AppliesTo,
            ValidFrom = @ValidFrom, ValidTo = @ValidTo,
            UsageLimit = @UsageLimit, UsageLimitPerUser = @UsageLimitPerUser,
            IsActive = @IsActive
        WHERE CouponId = @CouponId;
    END

    SELECT @CouponId AS CouponId, N'Saved' AS Message;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Coupon_ListForAdmin
    @Search       NVARCHAR(80) = NULL,
    @RestaurantId INT          = NULL,
    @IsActive     BIT          = NULL,
    @PageNumber   INT          = 1,
    @PageSize     INT          = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @PageNumber < 1 SET @PageNumber = 1;

    ;WITH Q AS
    (
        SELECT c.*, r.Name AS RestaurantName,
               CASE WHEN SYSUTCDATETIME() > c.ValidTo THEN N'EXPIRED'
                    WHEN SYSUTCDATETIME() < c.ValidFrom THEN N'SCHEDULED'
                    WHEN c.IsActive = 0 THEN N'INACTIVE'
                    WHEN c.UsageLimit IS NOT NULL AND c.UsedCount >= c.UsageLimit THEN N'EXHAUSTED'
                    ELSE N'LIVE' END AS ComputedStatus,
               COUNT(*) OVER() AS TotalCount
        FROM   dbo.Coupons c
        LEFT JOIN dbo.Restaurants r ON r.RestaurantId = c.RestaurantId
        WHERE (@IsActive IS NULL OR c.IsActive = @IsActive)
          AND (@RestaurantId IS NULL OR c.RestaurantId = @RestaurantId)
          AND (NULLIF(LTRIM(RTRIM(@Search)), N'') IS NULL
               OR c.Code LIKE N'%' + @Search + N'%'
               OR c.Title LIKE N'%' + @Search + N'%')
    )
    SELECT * FROM Q
    ORDER BY CreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Coupon_ToggleActive
    @CouponId INT,
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Coupons SET IsActive = @IsActive WHERE CouponId = @CouponId;
    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

/* ============================ ORDERS ========================== */

/* -----------------------------------------------------------------
   usp_Order_Create
   - items TVP se aate hain, price DB se hi liya jaata hai (tampering-proof)
   - 15 km delivery radius validate hota hai
   - coupon validate + usage log
   Output: @OrderId (0 = fail), @Message
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Order_Create
    @UserId       INT,
    @RestaurantId INT,
    @AddressId    INT            = NULL,
    @Items        dbo.OrderItemTableType READONLY,
    @CouponCode   NVARCHAR(40)   = NULL,
    @PaymentMode  NVARCHAR(20)   = 'ONLINE',
    @OrderType    NVARCHAR(20)   = 'DELIVERY',
    @CustomerNote NVARCHAR(500)  = NULL,
    @OrderId      BIGINT         OUTPUT,
    @Message      NVARCHAR(400)  OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @OrderId = 0;
    SET @Message = N'';

    /* ---------- basic validations ---------- */
    IF NOT EXISTS (SELECT 1 FROM @Items)
    BEGIN
        SET @Message = N'Cart khaali hai.';
        RETURN;
    END

    DECLARE @RestLat DECIMAL(9,6), @RestLng DECIMAL(9,6), @Radius DECIMAL(5,2),
            @PrepTime INT, @RestActive BIT, @AcceptsOnline BIT,
            @OpenT TIME(0), @CloseT TIME(0);

    SELECT @RestLat = Latitude, @RestLng = Longitude, @Radius = DeliveryRadiusKm,
           @PrepTime = AvgPrepTimeMin, @RestActive = IsActive,
           @AcceptsOnline = AcceptsOnlineOrder, @OpenT = OpeningTime, @CloseT = ClosingTime
    FROM   dbo.Restaurants WHERE RestaurantId = @RestaurantId;

    IF @RestLat IS NULL
    BEGIN
        SET @Message = N'Restaurant nahi mila.';
        RETURN;
    END

    IF @RestActive = 0 OR @AcceptsOnline = 0
    BEGIN
        SET @Message = N'Ye restaurant abhi online order nahi le raha.';
        RETURN;
    END

    IF dbo.fn_IsRestaurantOpen(@OpenT, @CloseT) = 0
    BEGIN
        SET @Message = N'Restaurant abhi band hai.';
        RETURN;
    END

    /* ---------- delivery address + distance (15 km rule) ---------- */
    DECLARE @DelAddr NVARCHAR(400) = N'Pickup at restaurant',
            @DelLat  DECIMAL(9,6)  = NULL,
            @DelLng  DECIMAL(9,6)  = NULL,
            @Distance DECIMAL(6,2) = 0,
            @DeliveryFee DECIMAL(10,2) = 0;

    IF @OrderType = 'DELIVERY'
    BEGIN
        IF @AddressId IS NULL
        BEGIN
            SET @Message = N'Delivery address select karo.';
            RETURN;
        END

        SELECT @DelAddr = CONCAT(AddressLine,
                                 CASE WHEN Landmark IS NULL THEN N'' ELSE N', ' + Landmark END,
                                 N', ', City,
                                 CASE WHEN Pincode IS NULL THEN N'' ELSE N' - ' + Pincode END),
               @DelLat = Latitude, @DelLng = Longitude
        FROM   dbo.UserAddresses
        WHERE  AddressId = @AddressId AND UserId = @UserId AND IsActive = 1;

        IF @DelLat IS NULL
        BEGIN
            SET @Message = N'Address valid nahi hai.';
            RETURN;
        END

        SET @Distance = dbo.fn_DistanceKm(@DelLat, @DelLng, @RestLat, @RestLng);

        IF @Distance > @Radius
        BEGIN
            SET @Message = N'Sorry, ye address delivery range se bahar hai ('
                         + CAST(@Distance AS NVARCHAR(20)) + N' km, limit '
                         + CAST(@Radius AS NVARCHAR(20)) + N' km).';
            RETURN;
        END

        SET @DeliveryFee = dbo.fn_DeliveryFee(@Distance);
        IF @DeliveryFee < 0
        BEGIN
            SET @Message = N'Delivery is distance par available nahi hai.';
            RETURN;
        END
    END

    /* ---------- item prices DB se resolve karo ---------- */
    DECLARE @Resolved TABLE
    (
        FoodItemId INT,
        ItemName   NVARCHAR(150),
        ItemImage  NVARCHAR(500),
        UnitPrice  DECIMAL(10,2),
        Quantity   INT,
        LineTotal  DECIMAL(12,2),
        Notes      NVARCHAR(300)
    );

    INSERT INTO @Resolved (FoodItemId, ItemName, ItemImage, UnitPrice, Quantity, LineTotal, Notes)
    SELECT fi.FoodItemId,
           fi.Name,
           fi.ImageUrl,
           CAST(ISNULL(fi.DiscountPrice, fi.Price) AS DECIMAL(10,2)),
           i.Quantity,
           CAST(ISNULL(fi.DiscountPrice, fi.Price) * i.Quantity AS DECIMAL(12,2)),
           i.Notes
    FROM   @Items i
    JOIN   dbo.FoodItems fi ON fi.FoodItemId = i.FoodItemId
    WHERE  fi.RestaurantId = @RestaurantId
      AND  fi.IsActive = 1
      AND  fi.IsAvailable = 1
      AND  i.Quantity > 0;

    IF (SELECT COUNT(*) FROM @Resolved) <> (SELECT COUNT(DISTINCT FoodItemId) FROM @Items)
    BEGIN
        SET @Message = N'Kuch items available nahi hain ya doosre restaurant ke hain. Cart refresh karo.';
        RETURN;
    END

    DECLARE @SubTotal DECIMAL(12,2) = (SELECT SUM(LineTotal) FROM @Resolved);

    /* ---------- coupon ---------- */
    DECLARE @CouponId INT = NULL, @DiscountAmount DECIMAL(12,2) = 0;

    IF NULLIF(LTRIM(RTRIM(@CouponCode)), N'') IS NOT NULL
    BEGIN
        DECLARE @CpResult TABLE (IsValid BIT, DiscountAmount DECIMAL(12,2),
                                 Message NVARCHAR(400), CouponId INT);

        INSERT INTO @CpResult
        EXEC dbo.usp_Coupon_Validate
             @Code = @CouponCode, @UserId = @UserId, @RestaurantId = @RestaurantId,
             @OrderAmount = @SubTotal, @AppliesTo = 'ORDER';

        IF EXISTS (SELECT 1 FROM @CpResult WHERE IsValid = 1)
            SELECT @CouponId = CouponId, @DiscountAmount = DiscountAmount FROM @CpResult;
        ELSE
        BEGIN
            SELECT @Message = Message FROM @CpResult;
            IF @Message IS NULL OR @Message = N'' SET @Message = N'Coupon valid nahi hai.';
            RETURN;
        END
    END

    /* ---------- charges ---------- */
    DECLARE @PackagingFee DECIMAL(12,2) = CASE WHEN @SubTotal < 300 THEN 15.00 ELSE 25.00 END;
    DECLARE @Taxable DECIMAL(12,2) = @SubTotal - @DiscountAmount;
    DECLARE @TaxAmount DECIMAL(12,2) = CAST(ROUND(@Taxable * 0.05, 2) AS DECIMAL(12,2));  -- 5% GST
    DECLARE @Total DECIMAL(12,2) = @Taxable + @DeliveryFee + @PackagingFee + @TaxAmount;
    DECLARE @Eta INT = @PrepTime + CEILING(@Distance * 3);

    /* ---------- insert ---------- */
    BEGIN TRAN;

    INSERT INTO dbo.Orders
        (OrderNumber, UserId, RestaurantId, AddressId, DeliveryAddress,
         DeliveryLatitude, DeliveryLongitude, DistanceKm, SubTotal, DiscountAmount,
         DeliveryFee, PackagingFee, TaxAmount, TotalAmount, CouponId, CouponCode,
         OrderType, Status, PaymentMode, PaymentStatus, CustomerNote, EtaMinutes)
    VALUES
        (N'TEMP', @UserId, @RestaurantId, @AddressId, @DelAddr,
         @DelLat, @DelLng, @Distance, @SubTotal, @DiscountAmount,
         @DeliveryFee, @PackagingFee, @TaxAmount, @Total, @CouponId, @CouponCode,
         @OrderType, 'PLACED', @PaymentMode,
         CASE WHEN @PaymentMode = 'COD' THEN 'PENDING' ELSE 'PENDING' END,
         @CustomerNote, @Eta);

    SET @OrderId = CAST(SCOPE_IDENTITY() AS BIGINT);

    UPDATE dbo.Orders
    SET    OrderNumber = dbo.fn_NextSequenceNumber(N'ORD', @OrderId)
    WHERE  OrderId = @OrderId;

    INSERT INTO dbo.OrderItems (OrderId, FoodItemId, ItemName, ItemImage, UnitPrice, Quantity, LineTotal, Notes)
    SELECT @OrderId, FoodItemId, ItemName, ItemImage, UnitPrice, Quantity, LineTotal, Notes
    FROM   @Resolved;

    INSERT INTO dbo.OrderStatusHistory (OrderId, Status, Remarks, ChangedByUserId)
    VALUES (@OrderId, 'PLACED', N'Order placed by customer', @UserId);

    IF @CouponId IS NOT NULL
    BEGIN
        INSERT INTO dbo.CouponUsages (CouponId, UserId, OrderId, Amount)
        VALUES (@CouponId, @UserId, @OrderId, @DiscountAmount);

        UPDATE dbo.Coupons SET UsedCount = UsedCount + 1 WHERE CouponId = @CouponId;
    END

    COMMIT TRAN;

    SET @Message = N'Order place ho gaya.';

    SELECT @OrderId AS OrderId,
           (SELECT OrderNumber FROM dbo.Orders WHERE OrderId = @OrderId) AS OrderNumber,
           @SubTotal AS SubTotal, @DiscountAmount AS DiscountAmount,
           @DeliveryFee AS DeliveryFee, @PackagingFee AS PackagingFee,
           @TaxAmount AS TaxAmount, @Total AS TotalAmount,
           @Distance AS DistanceKm, @Eta AS EtaMinutes, @Message AS Message;
END
GO

/* -----------------------------------------------------------------
   usp_Order_GetById : R1 order, R2 items, R3 status history
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Order_GetById
    @OrderId     BIGINT,
    @ForUserId   INT = NULL,   -- customer ownership check
    @RestrictToUser BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF @RestrictToUser = 1 AND NOT EXISTS
        (SELECT 1 FROM dbo.Orders WHERE OrderId = @OrderId AND UserId = @ForUserId)
    BEGIN
        SELECT TOP 0 CAST(NULL AS BIGINT) AS OrderId;
        RETURN;
    END

    SELECT  o.*,
            r.Name AS RestaurantName, r.Slug AS RestaurantSlug,
            r.ThumbnailUrl AS RestaurantImage, r.Locality, r.City, r.Phone AS RestaurantPhone,
            u.FullName AS CustomerName, u.Email AS CustomerEmail, u.Phone AS CustomerPhone,
            de.FullName AS DeliveryPersonName, de.Phone AS DeliveryPersonPhone
    FROM    dbo.Orders o
    JOIN    dbo.Restaurants r ON r.RestaurantId = o.RestaurantId
    JOIN    dbo.Users u       ON u.UserId       = o.UserId
    LEFT JOIN dbo.Users de    ON de.UserId      = o.DeliveryEmployeeId
    WHERE   o.OrderId = @OrderId;

    SELECT  oi.OrderItemId, oi.FoodItemId, oi.ItemName, oi.ItemImage,
            oi.UnitPrice, oi.Quantity, oi.LineTotal, oi.Notes,
            fi.IsVeg
    FROM    dbo.OrderItems oi
    LEFT JOIN dbo.FoodItems fi ON fi.FoodItemId = oi.FoodItemId
    WHERE   oi.OrderId = @OrderId
    ORDER BY oi.OrderItemId;

    SELECT  h.HistoryId, h.Status, h.Remarks, h.ChangedAt,
            u.FullName AS ChangedBy
    FROM    dbo.OrderStatusHistory h
    LEFT JOIN dbo.Users u ON u.UserId = h.ChangedByUserId
    WHERE   h.OrderId = @OrderId
    ORDER BY h.ChangedAt, h.HistoryId;

    SELECT  p.PaymentId, p.PaymentRef, p.GatewayName, p.GatewayPaymentId,
            p.Amount, p.Method, p.Status, p.CreatedAt, p.CompletedAt
    FROM    dbo.Payments p
    WHERE   p.OrderId = @OrderId
    ORDER BY p.PaymentId DESC;
END
GO

/* -----------------------------------------------------------------
   usp_Order_List
   Customer / Admin / Employee - teeno ke liye ek hi SP.
   @ForEmployeeId diya to sirf uske assigned restaurants ke orders.
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Order_List
    @UserId        INT           = NULL,   -- customer ke apne orders
    @RestaurantId  INT           = NULL,
    @Status        NVARCHAR(25)  = NULL,
    @PaymentStatus NVARCHAR(20)  = NULL,
    @Search        NVARCHAR(80)  = NULL,   -- order number / customer name / phone
    @FromDate      DATE          = NULL,
    @ToDate        DATE          = NULL,
    @ForEmployeeId INT           = NULL,
    @DeliveryEmployeeId INT      = NULL,
    @PageNumber    INT           = 1,
    @PageSize      INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   < 1 SET @PageSize   = 20;

    ;WITH Q AS
    (
        SELECT o.OrderId, o.OrderNumber, o.UserId, u.FullName AS CustomerName,
               u.Phone AS CustomerPhone,
               o.RestaurantId, r.Name AS RestaurantName, r.ThumbnailUrl AS RestaurantImage,
               o.DeliveryAddress, o.DistanceKm, o.SubTotal, o.DiscountAmount,
               o.DeliveryFee, o.PackagingFee, o.TaxAmount, o.TotalAmount,
               o.CouponCode, o.OrderType, o.Status, o.PaymentMode, o.PaymentStatus,
               o.DeliveryEmployeeId, de.FullName AS DeliveryPersonName,
               o.EtaMinutes, o.PlacedAt, o.DeliveredAt, o.CustomerNote, o.CancelReason,
               (SELECT COUNT(*) FROM dbo.OrderItems oi WHERE oi.OrderId = o.OrderId) AS ItemCount,
               (SELECT STRING_AGG(oi.ItemName + N' x' + CAST(oi.Quantity AS NVARCHAR(5)), N', ')
                FROM dbo.OrderItems oi WHERE oi.OrderId = o.OrderId) AS ItemSummary,
               COUNT(*) OVER() AS TotalCount
        FROM   dbo.Orders o
        JOIN   dbo.Users u ON u.UserId = o.UserId
        JOIN   dbo.Restaurants r ON r.RestaurantId = o.RestaurantId
        LEFT JOIN dbo.Users de ON de.UserId = o.DeliveryEmployeeId
        WHERE (@UserId        IS NULL OR o.UserId        = @UserId)
          AND (@RestaurantId  IS NULL OR o.RestaurantId  = @RestaurantId)
          AND (@Status        IS NULL OR o.Status        = @Status)
          AND (@PaymentStatus IS NULL OR o.PaymentStatus = @PaymentStatus)
          AND (@DeliveryEmployeeId IS NULL OR o.DeliveryEmployeeId = @DeliveryEmployeeId)
          AND (@FromDate IS NULL OR CAST(o.PlacedAt AS DATE) >= @FromDate)
          AND (@ToDate   IS NULL OR CAST(o.PlacedAt AS DATE) <= @ToDate)
          AND (NULLIF(LTRIM(RTRIM(@Search)), N'') IS NULL
               OR o.OrderNumber LIKE N'%' + @Search + N'%'
               OR u.FullName    LIKE N'%' + @Search + N'%'
               OR u.Phone       LIKE N'%' + @Search + N'%')
          AND (@ForEmployeeId IS NULL
               OR EXISTS (SELECT 1 FROM dbo.RestaurantEmployees re
                          WHERE re.RestaurantId = o.RestaurantId
                            AND re.UserId = @ForEmployeeId
                            AND re.IsActive = 1))
    )
    SELECT * FROM Q
    ORDER BY PlacedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* -----------------------------------------------------------------
   usp_Order_UpdateStatus  (valid transitions enforce karta hai)
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Order_UpdateStatus
    @OrderId    BIGINT,
    @NewStatus  NVARCHAR(25),
    @Remarks    NVARCHAR(400) = NULL,
    @ChangedByUserId INT      = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Current NVARCHAR(25) = (SELECT Status FROM dbo.Orders WHERE OrderId = @OrderId);

    IF @Current IS NULL
    BEGIN
        SELECT 0 AS AffectedRows, N'Order nahi mila.' AS Message;
        RETURN;
    END

    IF @Current IN ('DELIVERED','CANCELLED','REJECTED')
    BEGIN
        SELECT 0 AS AffectedRows,
               N'Order already ' + @Current + N' hai, status change nahi ho sakta.' AS Message;
        RETURN;
    END

    DECLARE @Allowed BIT = 0;

    IF (@Current = 'PLACED'    AND @NewStatus IN ('CONFIRMED','REJECTED','CANCELLED'))    SET @Allowed = 1;
    IF (@Current = 'CONFIRMED' AND @NewStatus IN ('PREPARING','CANCELLED'))               SET @Allowed = 1;
    IF (@Current = 'PREPARING' AND @NewStatus IN ('OUT_FOR_DELIVERY','CANCELLED'))        SET @Allowed = 1;
    IF (@Current = 'OUT_FOR_DELIVERY' AND @NewStatus = 'DELIVERED')                       SET @Allowed = 1;

    IF @Allowed = 0
    BEGIN
        SELECT 0 AS AffectedRows,
               @Current + N' se ' + @NewStatus + N' allowed nahi hai.' AS Message;
        RETURN;
    END

    BEGIN TRAN;

    UPDATE dbo.Orders
    SET    Status = @NewStatus,
           CancelReason = CASE WHEN @NewStatus IN ('CANCELLED','REJECTED') THEN @Remarks ELSE CancelReason END,
           DeliveredAt  = CASE WHEN @NewStatus = 'DELIVERED' THEN SYSUTCDATETIME() ELSE DeliveredAt END,
           PaymentStatus = CASE WHEN @NewStatus = 'DELIVERED' AND PaymentMode = 'COD' THEN 'PAID'
                                WHEN @NewStatus IN ('CANCELLED','REJECTED') AND PaymentStatus = 'PAID' THEN 'REFUNDED'
                                ELSE PaymentStatus END,
           UpdatedAt = SYSUTCDATETIME()
    WHERE  OrderId = @OrderId;

    INSERT INTO dbo.OrderStatusHistory (OrderId, Status, Remarks, ChangedByUserId)
    VALUES (@OrderId, @NewStatus, @Remarks, @ChangedByUserId);

    COMMIT TRAN;

    SELECT 1 AS AffectedRows, N'Status updated to ' + @NewStatus AS Message;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Order_AssignDelivery
    @OrderId            BIGINT,
    @DeliveryEmployeeId INT,
    @AssignedByUserId   INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RestId INT = (SELECT RestaurantId FROM dbo.Orders WHERE OrderId = @OrderId);

    IF @RestId IS NULL
    BEGIN
        SELECT 0 AS AffectedRows, N'Order nahi mila.' AS Message;
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.RestaurantEmployees re
                   WHERE re.UserId = @DeliveryEmployeeId
                     AND re.RestaurantId = @RestId AND re.IsActive = 1)
    BEGIN
        SELECT 0 AS AffectedRows, N'Ye employee is restaurant par assigned nahi hai.' AS Message;
        RETURN;
    END

    UPDATE dbo.Orders
    SET    DeliveryEmployeeId = @DeliveryEmployeeId, UpdatedAt = SYSUTCDATETIME()
    WHERE  OrderId = @OrderId;

    INSERT INTO dbo.OrderStatusHistory (OrderId, Status, Remarks, ChangedByUserId)
    SELECT @OrderId, Status,
           N'Delivery assigned to ' + (SELECT FullName FROM dbo.Users WHERE UserId = @DeliveryEmployeeId),
           @AssignedByUserId
    FROM   dbo.Orders WHERE OrderId = @OrderId;

    SELECT 1 AS AffectedRows, N'Delivery partner assign ho gaya.' AS Message;
END
GO

/* =========================== PAYMENTS ========================== */
CREATE PROCEDURE dbo.usp_Payment_Create
    @UserId         INT,
    @OrderId        BIGINT        = NULL,
    @HallBookingId  BIGINT        = NULL,
    @PurposeType    NVARCHAR(20),
    @Amount         DECIMAL(12,2),
    @GatewayName    NVARCHAR(40)  = 'MOCK',
    @GatewayOrderId NVARCHAR(100) = NULL,
    @PaymentRef     NVARCHAR(60)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.Payments
        (PaymentRef, GatewayName, GatewayOrderId, UserId, OrderId, HallBookingId,
         PurposeType, Amount, Status)
    VALUES
        (@PaymentRef, @GatewayName, @GatewayOrderId, @UserId, @OrderId, @HallBookingId,
         @PurposeType, @Amount, 'CREATED');

    SELECT CAST(SCOPE_IDENTITY() AS BIGINT) AS PaymentId, @PaymentRef AS PaymentRef;
END
GO

/* -----------------------------------------------------------------
   usp_Payment_Complete
   Gateway callback / verify ke baad. PAID hone par order ka
   PaymentStatus aur Status dono aage badh jaate hain.
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Payment_Complete
    @PaymentRef       NVARCHAR(60),
    @GatewayPaymentId NVARCHAR(100) = NULL,
    @GatewaySignature NVARCHAR(400) = NULL,
    @Status           NVARCHAR(20),          -- PAID | FAILED
    @Method           NVARCHAR(30)  = NULL,
    @FailureReason    NVARCHAR(400) = NULL,
    @RawPayload       NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @PaymentId BIGINT, @OrderId BIGINT, @HallId BIGINT, @Purpose NVARCHAR(20);

    SELECT @PaymentId = PaymentId, @OrderId = OrderId,
           @HallId = HallBookingId, @Purpose = PurposeType
    FROM   dbo.Payments WHERE PaymentRef = @PaymentRef;

    IF @PaymentId IS NULL
    BEGIN
        SELECT 0 AS AffectedRows, N'Payment reference nahi mila.' AS Message;
        RETURN;
    END

    BEGIN TRAN;

    UPDATE dbo.Payments
    SET    GatewayPaymentId = @GatewayPaymentId,
           GatewaySignature = @GatewaySignature,
           Status = @Status, Method = @Method,
           FailureReason = @FailureReason, RawPayload = @RawPayload,
           CompletedAt = SYSUTCDATETIME()
    WHERE  PaymentId = @PaymentId;

    IF @Status = 'PAID'
    BEGIN
        IF @Purpose = 'ORDER' AND @OrderId IS NOT NULL
        BEGIN
            UPDATE dbo.Orders
            SET    PaymentStatus = 'PAID',
                   Status = CASE WHEN Status = 'PLACED' THEN 'CONFIRMED' ELSE Status END,
                   UpdatedAt = SYSUTCDATETIME()
            WHERE  OrderId = @OrderId;

            INSERT INTO dbo.OrderStatusHistory (OrderId, Status, Remarks)
            VALUES (@OrderId, 'CONFIRMED', N'Payment received - ' + ISNULL(@Method, N'ONLINE'));
        END

        IF @Purpose = 'HALL' AND @HallId IS NOT NULL
            UPDATE dbo.HallBookings
            SET    PaymentStatus = 'PAID',
                   AdvanceAmount = (SELECT Amount FROM dbo.Payments WHERE PaymentId = @PaymentId),
                   Status = CASE WHEN Status = 'PENDING' THEN 'CONFIRMED' ELSE Status END,
                   UpdatedAt = SYSUTCDATETIME()
            WHERE  BookingId = @HallId;
    END
    ELSE IF @Status = 'FAILED'
    BEGIN
        IF @Purpose = 'ORDER' AND @OrderId IS NOT NULL
            UPDATE dbo.Orders SET PaymentStatus = 'FAILED', UpdatedAt = SYSUTCDATETIME()
            WHERE OrderId = @OrderId;

        IF @Purpose = 'HALL' AND @HallId IS NOT NULL
            UPDATE dbo.HallBookings SET PaymentStatus = 'FAILED', UpdatedAt = SYSUTCDATETIME()
            WHERE BookingId = @HallId;
    END

    COMMIT TRAN;

    SELECT 1 AS AffectedRows, N'Payment ' + @Status AS Message,
           @OrderId AS OrderId, @HallId AS HallBookingId;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Payment_List
    @UserId     INT          = NULL,
    @Status     NVARCHAR(20) = NULL,
    @FromDate   DATE         = NULL,
    @ToDate     DATE         = NULL,
    @PageNumber INT          = 1,
    @PageSize   INT          = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @PageNumber < 1 SET @PageNumber = 1;

    ;WITH Q AS
    (
        SELECT p.PaymentId, p.PaymentRef, p.GatewayName, p.GatewayPaymentId,
               p.UserId, u.FullName AS CustomerName, u.Email AS CustomerEmail,
               p.OrderId, o.OrderNumber, p.HallBookingId, hb.BookingNumber AS HallBookingNumber,
               p.PurposeType, p.Amount, p.Currency, p.Method, p.Status,
               p.FailureReason, p.CreatedAt, p.CompletedAt,
               COUNT(*) OVER() AS TotalCount
        FROM   dbo.Payments p
        JOIN   dbo.Users u ON u.UserId = p.UserId
        LEFT JOIN dbo.Orders o        ON o.OrderId   = p.OrderId
        LEFT JOIN dbo.HallBookings hb ON hb.BookingId = p.HallBookingId
        WHERE (@UserId IS NULL OR p.UserId = @UserId)
          AND (@Status IS NULL OR p.Status = @Status)
          AND (@FromDate IS NULL OR CAST(p.CreatedAt AS DATE) >= @FromDate)
          AND (@ToDate   IS NULL OR CAST(p.CreatedAt AS DATE) <= @ToDate)
    )
    SELECT * FROM Q
    ORDER BY CreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

PRINT 'Order / Coupon / Payment stored procedures created.';
GO
