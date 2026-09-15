/* ============================================================
   ZomatoClone - Stored Procedures :
   Employees (restaurant assignment) / Reviews / Testimonials /
   Dashboard analytics / App settings
   ============================================================ */
USE ZomatoCloneDb;
GO

/* XML/STRING_AGG aur indexed views ke liye ye settings ON chahiye.
   sqlcmd default me QUOTED_IDENTIFIER OFF rakhta hai, isliye explicit. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.usp_Employee_Save','P')             IS NOT NULL DROP PROCEDURE dbo.usp_Employee_Save;
IF OBJECT_ID('dbo.usp_Employee_List','P')             IS NOT NULL DROP PROCEDURE dbo.usp_Employee_List;
IF OBJECT_ID('dbo.usp_Employee_AssignRestaurant','P') IS NOT NULL DROP PROCEDURE dbo.usp_Employee_AssignRestaurant;
IF OBJECT_ID('dbo.usp_Employee_UnassignRestaurant','P') IS NOT NULL DROP PROCEDURE dbo.usp_Employee_UnassignRestaurant;
IF OBJECT_ID('dbo.usp_Employee_GetAssignments','P')   IS NOT NULL DROP PROCEDURE dbo.usp_Employee_GetAssignments;
IF OBJECT_ID('dbo.usp_Employee_ToggleActive','P')     IS NOT NULL DROP PROCEDURE dbo.usp_Employee_ToggleActive;
IF OBJECT_ID('dbo.usp_Review_Add','P')                IS NOT NULL DROP PROCEDURE dbo.usp_Review_Add;
IF OBJECT_ID('dbo.usp_Review_List','P')               IS NOT NULL DROP PROCEDURE dbo.usp_Review_List;
IF OBJECT_ID('dbo.usp_Review_Moderate','P')           IS NOT NULL DROP PROCEDURE dbo.usp_Review_Moderate;
IF OBJECT_ID('dbo.usp_Review_Like','P')               IS NOT NULL DROP PROCEDURE dbo.usp_Review_Like;
IF OBJECT_ID('dbo.usp_Testimonial_Save','P')          IS NOT NULL DROP PROCEDURE dbo.usp_Testimonial_Save;
IF OBJECT_ID('dbo.usp_Testimonial_List','P')          IS NOT NULL DROP PROCEDURE dbo.usp_Testimonial_List;
IF OBJECT_ID('dbo.usp_Testimonial_Delete','P')        IS NOT NULL DROP PROCEDURE dbo.usp_Testimonial_Delete;
IF OBJECT_ID('dbo.usp_Dashboard_AdminStats','P')      IS NOT NULL DROP PROCEDURE dbo.usp_Dashboard_AdminStats;
IF OBJECT_ID('dbo.usp_Dashboard_EmployeeStats','P')   IS NOT NULL DROP PROCEDURE dbo.usp_Dashboard_EmployeeStats;
IF OBJECT_ID('dbo.usp_Home_Sections','P')             IS NOT NULL DROP PROCEDURE dbo.usp_Home_Sections;
IF OBJECT_ID('dbo.usp_Setting_GetAll','P')            IS NOT NULL DROP PROCEDURE dbo.usp_Setting_GetAll;
IF OBJECT_ID('dbo.usp_Setting_Save','P')              IS NOT NULL DROP PROCEDURE dbo.usp_Setting_Save;
GO

/* ========================== EMPLOYEES ========================= */

/* -----------------------------------------------------------------
   usp_Employee_Save
   Naya employee banata hai (ya update) - Role = Employee.
   Password hash API se aata hai.
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Employee_Save
    @UserId       INT           = 0,
    @FullName     NVARCHAR(120),
    @Email        NVARCHAR(160),
    @Phone        NVARCHAR(20)  = NULL,
    @PasswordHash NVARCHAR(400) = NULL,   -- update par NULL = password same
    @ProfileImage NVARCHAR(500) = NULL,
    @IsActive     BIT           = 1
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RoleId INT = (SELECT RoleId FROM dbo.Roles WHERE RoleName = N'Employee');

    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @Email AND UserId <> ISNULL(@UserId, 0))
    BEGIN
        SELECT -1 AS UserId, N'Ye email pehle se registered hai.' AS Message;
        RETURN;
    END

    IF @UserId IS NULL OR @UserId = 0
    BEGIN
        IF @PasswordHash IS NULL
        BEGIN
            SELECT -1 AS UserId, N'Naye employee ke liye password zaroori hai.' AS Message;
            RETURN;
        END

        INSERT INTO dbo.Users (FullName, Email, Phone, PasswordHash, RoleId, ProfileImage, IsActive)
        VALUES (@FullName, @Email, @Phone, @PasswordHash, @RoleId, @ProfileImage, @IsActive);

        SET @UserId = CAST(SCOPE_IDENTITY() AS INT);
    END
    ELSE
    BEGIN
        UPDATE dbo.Users
        SET FullName = @FullName, Email = @Email, Phone = @Phone,
            PasswordHash = ISNULL(@PasswordHash, PasswordHash),
            ProfileImage = ISNULL(@ProfileImage, ProfileImage),
            IsActive = @IsActive, UpdatedAt = SYSUTCDATETIME()
        WHERE UserId = @UserId;
    END

    SELECT @UserId AS UserId, N'Saved' AS Message;
END
GO

/* -----------------------------------------------------------------
   usp_Employee_List
   Har employee ke saath uske assigned restaurants ki list (CSV).
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Employee_List
    @Search       NVARCHAR(120) = NULL,
    @RestaurantId INT           = NULL,   -- kis restaurant ke employees
    @Designation  NVARCHAR(80)  = NULL,
    @IsActive     BIT           = NULL,
    @Unassigned   BIT           = 0,      -- 1 = jinko koi restaurant nahi mila
    @PageNumber   INT           = 1,
    @PageSize     INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @PageNumber < 1 SET @PageNumber = 1;

    ;WITH Q AS
    (
        SELECT u.UserId, u.FullName, u.Email, u.Phone, u.ProfileImage, u.IsActive, u.CreatedAt,
               (SELECT COUNT(*) FROM dbo.RestaurantEmployees re
                WHERE re.UserId = u.UserId AND re.IsActive = 1) AS AssignedRestaurantCount,
               (SELECT STRING_AGG(r.Name, N', ') WITHIN GROUP (ORDER BY r.Name)
                FROM dbo.RestaurantEmployees re
                JOIN dbo.Restaurants r ON r.RestaurantId = re.RestaurantId
                WHERE re.UserId = u.UserId AND re.IsActive = 1) AS AssignedRestaurants,
               (SELECT STRING_AGG(re.Designation, N', ')
                FROM dbo.RestaurantEmployees re
                WHERE re.UserId = u.UserId AND re.IsActive = 1) AS Designations,
               (SELECT COUNT(*) FROM dbo.Orders o
                WHERE o.DeliveryEmployeeId = u.UserId AND o.Status = 'DELIVERED') AS DeliveredOrders,
               COUNT(*) OVER() AS TotalCount
        FROM   dbo.Users u
        JOIN   dbo.Roles ro ON ro.RoleId = u.RoleId
        WHERE  ro.RoleName = N'Employee'
          AND (@IsActive IS NULL OR u.IsActive = @IsActive)
          AND (NULLIF(LTRIM(RTRIM(@Search)), N'') IS NULL
               OR u.FullName LIKE N'%' + @Search + N'%'
               OR u.Email    LIKE N'%' + @Search + N'%'
               OR u.Phone    LIKE N'%' + @Search + N'%')
          AND (@RestaurantId IS NULL
               OR EXISTS (SELECT 1 FROM dbo.RestaurantEmployees re
                          WHERE re.UserId = u.UserId AND re.RestaurantId = @RestaurantId
                            AND re.IsActive = 1))
          AND (@Designation IS NULL
               OR EXISTS (SELECT 1 FROM dbo.RestaurantEmployees re
                          WHERE re.UserId = u.UserId AND re.Designation = @Designation
                            AND re.IsActive = 1))
          AND (@Unassigned = 0
               OR NOT EXISTS (SELECT 1 FROM dbo.RestaurantEmployees re
                              WHERE re.UserId = u.UserId AND re.IsActive = 1))
    )
    SELECT * FROM Q
    ORDER BY FullName
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* -----------------------------------------------------------------
   usp_Employee_AssignRestaurant
   "Kisko kaunsa restaurant dena hai" - yahi SP.
   Same pair dobara aaya to permissions update ho jaate hain.
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Employee_AssignRestaurant
    @UserId           INT,
    @RestaurantId     INT,
    @Designation      NVARCHAR(80) = N'Manager',
    @CanManageMenu    BIT          = 0,
    @CanManageOrder   BIT          = 1,
    @CanManageBooking BIT          = 0,
    @AssignedByUserId INT          = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId = u.RoleId
                   WHERE u.UserId = @UserId AND r.RoleName = N'Employee')
    BEGIN
        SELECT -1 AS AssignmentId, N'Ye user employee nahi hai.' AS Message;
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Restaurants WHERE RestaurantId = @RestaurantId)
    BEGIN
        SELECT -1 AS AssignmentId, N'Restaurant nahi mila.' AS Message;
        RETURN;
    END

    DECLARE @AssignmentId INT =
        (SELECT AssignmentId FROM dbo.RestaurantEmployees
         WHERE UserId = @UserId AND RestaurantId = @RestaurantId);

    IF @AssignmentId IS NULL
    BEGIN
        INSERT INTO dbo.RestaurantEmployees
            (UserId, RestaurantId, Designation, CanManageMenu, CanManageOrder,
             CanManageBooking, AssignedByUserId, IsActive)
        VALUES
            (@UserId, @RestaurantId, @Designation, @CanManageMenu, @CanManageOrder,
             @CanManageBooking, @AssignedByUserId, 1);

        SET @AssignmentId = CAST(SCOPE_IDENTITY() AS INT);
    END
    ELSE
    BEGIN
        UPDATE dbo.RestaurantEmployees
        SET Designation = @Designation, CanManageMenu = @CanManageMenu,
            CanManageOrder = @CanManageOrder, CanManageBooking = @CanManageBooking,
            AssignedByUserId = ISNULL(@AssignedByUserId, AssignedByUserId),
            AssignedAt = SYSUTCDATETIME(), IsActive = 1
        WHERE AssignmentId = @AssignmentId;
    END

    SELECT @AssignmentId AS AssignmentId,
           N'Restaurant assign ho gaya: '
           + (SELECT Name FROM dbo.Restaurants WHERE RestaurantId = @RestaurantId) AS Message;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Employee_UnassignRestaurant
    @UserId       INT,
    @RestaurantId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.RestaurantEmployees
    SET    IsActive = 0
    WHERE  UserId = @UserId AND RestaurantId = @RestaurantId;

    SELECT @@ROWCOUNT AS AffectedRows, N'Assignment hata diya gaya.' AS Message;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Employee_GetAssignments
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT re.AssignmentId, re.UserId, re.RestaurantId,
           r.Name AS RestaurantName, r.Slug, r.ThumbnailUrl, r.Locality, r.City,
           re.Designation, re.CanManageMenu, re.CanManageOrder, re.CanManageBooking,
           re.AssignedAt, re.IsActive,
           ab.FullName AS AssignedBy,
           (SELECT COUNT(*) FROM dbo.Orders o
            WHERE o.RestaurantId = re.RestaurantId
              AND o.Status IN ('PLACED','CONFIRMED','PREPARING','OUT_FOR_DELIVERY')) AS PendingOrders
    FROM   dbo.RestaurantEmployees re
    JOIN   dbo.Restaurants r ON r.RestaurantId = re.RestaurantId
    LEFT JOIN dbo.Users ab   ON ab.UserId      = re.AssignedByUserId
    WHERE  re.UserId = @UserId AND re.IsActive = 1
    ORDER BY r.Name;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Employee_ToggleActive
    @UserId   INT,
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Users SET IsActive = @IsActive, UpdatedAt = SYSUTCDATETIME()
    WHERE  UserId = @UserId;

    IF @IsActive = 0
        UPDATE dbo.RefreshTokens SET IsRevoked = 1 WHERE UserId = @UserId AND IsRevoked = 0;

    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

/* =========================== REVIEWS ========================== */

/* -----------------------------------------------------------------
   usp_Review_Add
   Sirf DELIVERED order par review allowed (agar OrderId diya hai).
   Restaurant ka average rating recalculate hota hai.
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Review_Add
    @RestaurantId  INT,
    @UserId        INT,
    @OrderId       BIGINT        = NULL,
    @Rating        DECIMAL(3,2),
    @FoodRating    DECIMAL(3,2)  = NULL,
    @ServiceRating DECIMAL(3,2)  = NULL,
    @Title         NVARCHAR(150) = NULL,
    @Comment       NVARCHAR(MAX) = NULL,
    @ImageUrl      NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Rating < 1 OR @Rating > 5
    BEGIN
        SELECT -1 AS ReviewId, N'Rating 1 se 5 ke beech honi chahiye.' AS Message;
        RETURN;
    END

    IF @OrderId IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.Orders
                       WHERE OrderId = @OrderId AND UserId = @UserId
                         AND RestaurantId = @RestaurantId AND Status = 'DELIVERED')
        BEGIN
            SELECT -1 AS ReviewId, N'Review sirf delivered order par de sakte hain.' AS Message;
            RETURN;
        END

        IF EXISTS (SELECT 1 FROM dbo.Reviews WHERE OrderId = @OrderId)
        BEGIN
            SELECT -1 AS ReviewId, N'Is order ka review pehle hi diya ja chuka hai.' AS Message;
            RETURN;
        END
    END

    BEGIN TRAN;

    INSERT INTO dbo.Reviews
        (RestaurantId, UserId, OrderId, Rating, FoodRating, ServiceRating,
         Title, Comment, ImageUrl, IsApproved)
    VALUES
        (@RestaurantId, @UserId, @OrderId, @Rating, @FoodRating, @ServiceRating,
         @Title, @Comment, @ImageUrl, 1);

    DECLARE @ReviewId BIGINT = CAST(SCOPE_IDENTITY() AS BIGINT);

    /* restaurant rating recalc */
    UPDATE r
    SET    r.Rating = ISNULL(agg.AvgRating, 0),
           r.TotalReviews = ISNULL(agg.Cnt, 0),
           r.UpdatedAt = SYSUTCDATETIME()
    FROM   dbo.Restaurants r
    CROSS APPLY (SELECT CAST(AVG(rv.Rating) AS DECIMAL(3,2)) AS AvgRating, COUNT(*) AS Cnt
                 FROM   dbo.Reviews rv
                 WHERE  rv.RestaurantId = @RestaurantId AND rv.IsApproved = 1) agg
    WHERE  r.RestaurantId = @RestaurantId;

    COMMIT TRAN;

    SELECT @ReviewId AS ReviewId, N'Review add ho gaya. Shukriya!' AS Message,
           (SELECT Rating FROM dbo.Restaurants WHERE RestaurantId = @RestaurantId) AS NewRestaurantRating;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Review_List
    @RestaurantId INT          = NULL,
    @UserId       INT          = NULL,
    @MinRating    DECIMAL(3,2) = NULL,
    @IsApproved   BIT          = NULL,
    @SortBy       NVARCHAR(20) = N'newest',  -- newest | rating_high | rating_low | helpful
    @PageNumber   INT          = 1,
    @PageSize     INT          = 10
AS
BEGIN
    SET NOCOUNT ON;

    IF @PageNumber < 1 SET @PageNumber = 1;

    ;WITH Q AS
    (
        SELECT rv.ReviewId, rv.RestaurantId, r.Name AS RestaurantName, r.Slug AS RestaurantSlug,
               rv.UserId, u.FullName AS UserName, u.ProfileImage AS UserImage,
               rv.OrderId, o.OrderNumber,
               rv.Rating, rv.FoodRating, rv.ServiceRating, rv.Title, rv.Comment,
               rv.ImageUrl, rv.LikeCount, rv.IsApproved, rv.CreatedAt,
               COUNT(*) OVER() AS TotalCount
        FROM   dbo.Reviews rv
        JOIN   dbo.Restaurants r ON r.RestaurantId = rv.RestaurantId
        JOIN   dbo.Users u       ON u.UserId       = rv.UserId
        LEFT JOIN dbo.Orders o   ON o.OrderId      = rv.OrderId
        WHERE (@RestaurantId IS NULL OR rv.RestaurantId = @RestaurantId)
          AND (@UserId       IS NULL OR rv.UserId       = @UserId)
          AND (@MinRating    IS NULL OR rv.Rating      >= @MinRating)
          AND (@IsApproved   IS NULL OR rv.IsApproved   = @IsApproved)
    )
    SELECT * FROM Q
    ORDER BY
        CASE WHEN @SortBy = N'rating_high' THEN Rating    END DESC,
        CASE WHEN @SortBy = N'rating_low'  THEN Rating    END ASC,
        CASE WHEN @SortBy = N'helpful'     THEN LikeCount END DESC,
        CreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Review_Moderate
    @ReviewId   BIGINT,
    @IsApproved BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @RestId INT = (SELECT RestaurantId FROM dbo.Reviews WHERE ReviewId = @ReviewId);

    IF @RestId IS NULL
    BEGIN
        SELECT 0 AS AffectedRows, N'Review nahi mila.' AS Message;
        RETURN;
    END

    BEGIN TRAN;

    UPDATE dbo.Reviews SET IsApproved = @IsApproved WHERE ReviewId = @ReviewId;

    UPDATE r
    SET    r.Rating = ISNULL(agg.AvgRating, 0), r.TotalReviews = ISNULL(agg.Cnt, 0)
    FROM   dbo.Restaurants r
    CROSS APPLY (SELECT CAST(AVG(rv.Rating) AS DECIMAL(3,2)) AS AvgRating, COUNT(*) AS Cnt
                 FROM   dbo.Reviews rv
                 WHERE  rv.RestaurantId = @RestId AND rv.IsApproved = 1) agg
    WHERE  r.RestaurantId = @RestId;

    COMMIT TRAN;

    SELECT 1 AS AffectedRows,
           CASE WHEN @IsApproved = 1 THEN N'Review approved.' ELSE N'Review hidden.' END AS Message;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Review_Like
    @ReviewId BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Reviews SET LikeCount = LikeCount + 1 WHERE ReviewId = @ReviewId;
    SELECT LikeCount FROM dbo.Reviews WHERE ReviewId = @ReviewId;
END
GO

/* ======================== TESTIMONIALS ======================== */
CREATE PROCEDURE dbo.usp_Testimonial_Save
    @TestimonialId INT            = 0,
    @CustomerName  NVARCHAR(120),
    @CustomerImage NVARCHAR(500)  = NULL,
    @City          NVARCHAR(80)   = NULL,
    @Designation   NVARCHAR(120)  = NULL,
    @Rating        DECIMAL(3,2)   = 5,
    @Message       NVARCHAR(1000),
    @DisplayOrder  INT            = 0,
    @IsActive      BIT            = 1
AS
BEGIN
    SET NOCOUNT ON;

    IF @TestimonialId IS NULL OR @TestimonialId = 0
    BEGIN
        INSERT INTO dbo.Testimonials
            (CustomerName, CustomerImage, City, Designation, Rating, Message, DisplayOrder, IsActive)
        VALUES
            (@CustomerName, @CustomerImage, @City, @Designation, @Rating, @Message, @DisplayOrder, @IsActive);

        SET @TestimonialId = CAST(SCOPE_IDENTITY() AS INT);
    END
    ELSE
    BEGIN
        UPDATE dbo.Testimonials
        SET CustomerName = @CustomerName,
            CustomerImage = ISNULL(@CustomerImage, CustomerImage),
            City = @City, Designation = @Designation, Rating = @Rating,
            Message = @Message, DisplayOrder = @DisplayOrder, IsActive = @IsActive
        WHERE TestimonialId = @TestimonialId;
    END

    SELECT @TestimonialId AS TestimonialId, N'Saved' AS ResultMessage;
END
GO

CREATE PROCEDURE dbo.usp_Testimonial_List
    @IncludeInactive BIT = 0,
    @TopN            INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (ISNULL(@TopN, 1000))
           TestimonialId, CustomerName, CustomerImage, City, Designation,
           Rating, Message, DisplayOrder, IsActive, CreatedAt
    FROM   dbo.Testimonials
    WHERE  @IncludeInactive = 1 OR IsActive = 1
    ORDER BY DisplayOrder, CreatedAt DESC;
END
GO

CREATE PROCEDURE dbo.usp_Testimonial_Delete
    @TestimonialId INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.Testimonials WHERE TestimonialId = @TestimonialId;
    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

/* ====================== DASHBOARD / STATS ===================== */

/* -----------------------------------------------------------------
   usp_Dashboard_AdminStats
   R1 KPI cards | R2 last 14 din revenue | R3 top restaurants
   R4 order status breakdown | R5 top dishes | R6 recent orders
   R7 bookings summary
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Dashboard_AdminStats
    @FromDate DATE = NULL,
    @ToDate   DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS DATE);
    IF @ToDate   IS NULL SET @ToDate   = @Today;
    IF @FromDate IS NULL SET @FromDate = DATEADD(DAY, -29, @ToDate);

    /* R1 : KPI */
    SELECT
        (SELECT COUNT(*) FROM dbo.Restaurants WHERE IsActive = 1) AS ActiveRestaurants,
        (SELECT COUNT(*) FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId = u.RoleId
         WHERE r.RoleName = N'Customer') AS TotalCustomers,
        (SELECT COUNT(*) FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId = u.RoleId
         WHERE r.RoleName = N'Employee' AND u.IsActive = 1) AS ActiveEmployees,
        (SELECT COUNT(*) FROM dbo.FoodItems WHERE IsActive = 1) AS TotalMenuItems,
        (SELECT COUNT(*) FROM dbo.Orders) AS TotalOrders,
        (SELECT COUNT(*) FROM dbo.Orders WHERE CAST(PlacedAt AS DATE) = @Today) AS TodayOrders,
        (SELECT ISNULL(SUM(TotalAmount), 0) FROM dbo.Orders
         WHERE PaymentStatus = 'PAID') AS TotalRevenue,
        (SELECT ISNULL(SUM(TotalAmount), 0) FROM dbo.Orders
         WHERE PaymentStatus = 'PAID' AND CAST(PlacedAt AS DATE) = @Today) AS TodayRevenue,
        (SELECT COUNT(*) FROM dbo.Orders
         WHERE Status IN ('PLACED','CONFIRMED','PREPARING','OUT_FOR_DELIVERY')) AS PendingOrders,
        (SELECT COUNT(*) FROM dbo.TableBookings WHERE Status = 'PENDING') AS PendingTableBookings,
        (SELECT COUNT(*) FROM dbo.HallBookings  WHERE Status = 'PENDING') AS PendingHallBookings,
        (SELECT COUNT(*) FROM dbo.Reviews WHERE IsApproved = 0) AS PendingReviews,
        (SELECT CAST(ISNULL(AVG(Rating), 0) AS DECIMAL(3,2)) FROM dbo.Reviews WHERE IsApproved = 1) AS AvgRating,
        (SELECT COUNT(*) FROM dbo.Coupons WHERE IsActive = 1
           AND SYSUTCDATETIME() BETWEEN ValidFrom AND ValidTo) AS LiveCoupons;

    /* R2 : daily revenue trend */
    ;WITH Dates AS
    (
        SELECT @FromDate AS D
        UNION ALL
        SELECT DATEADD(DAY, 1, D) FROM Dates WHERE D < @ToDate
    )
    SELECT d.D AS OrderDate,
           ISNULL(COUNT(o.OrderId), 0) AS OrderCount,
           ISNULL(SUM(CASE WHEN o.PaymentStatus = 'PAID' THEN o.TotalAmount ELSE 0 END), 0) AS Revenue
    FROM   Dates d
    LEFT JOIN dbo.Orders o ON CAST(o.PlacedAt AS DATE) = d.D
    GROUP BY d.D
    ORDER BY d.D
    OPTION (MAXRECURSION 400);

    /* R3 : top restaurants */
    SELECT TOP 10
           r.RestaurantId, r.Name, r.ThumbnailUrl, r.Locality, r.City, r.Rating,
           COUNT(o.OrderId) AS OrderCount,
           ISNULL(SUM(CASE WHEN o.PaymentStatus = 'PAID' THEN o.TotalAmount ELSE 0 END), 0) AS Revenue
    FROM   dbo.Restaurants r
    LEFT JOIN dbo.Orders o ON o.RestaurantId = r.RestaurantId
                          AND CAST(o.PlacedAt AS DATE) BETWEEN @FromDate AND @ToDate
    GROUP BY r.RestaurantId, r.Name, r.ThumbnailUrl, r.Locality, r.City, r.Rating
    ORDER BY Revenue DESC, OrderCount DESC;

    /* R4 : order status breakdown */
    SELECT Status, COUNT(*) AS Cnt, ISNULL(SUM(TotalAmount), 0) AS Amount
    FROM   dbo.Orders
    WHERE  CAST(PlacedAt AS DATE) BETWEEN @FromDate AND @ToDate
    GROUP BY Status;

    /* R5 : top selling dishes */
    SELECT TOP 10
           oi.FoodItemId, oi.ItemName, MAX(oi.ItemImage) AS ItemImage,
           SUM(oi.Quantity) AS QtySold,
           SUM(oi.LineTotal) AS Revenue,
           MAX(r.Name) AS RestaurantName
    FROM   dbo.OrderItems oi
    JOIN   dbo.Orders o ON o.OrderId = oi.OrderId
    JOIN   dbo.Restaurants r ON r.RestaurantId = o.RestaurantId
    WHERE  CAST(o.PlacedAt AS DATE) BETWEEN @FromDate AND @ToDate
    GROUP BY oi.FoodItemId, oi.ItemName
    ORDER BY QtySold DESC;

    /* R6 : recent orders */
    SELECT TOP 10
           o.OrderId, o.OrderNumber, u.FullName AS CustomerName,
           r.Name AS RestaurantName, o.TotalAmount, o.Status, o.PaymentStatus, o.PlacedAt
    FROM   dbo.Orders o
    JOIN   dbo.Users u ON u.UserId = o.UserId
    JOIN   dbo.Restaurants r ON r.RestaurantId = o.RestaurantId
    ORDER BY o.PlacedAt DESC;

    /* R7 : bookings summary
       Bookings future-dated hoti hain, isliye "in range" (jo dates di gayi)
       ke saath "upcoming" (aaj se aage 30 din) bhi dete hain - dashboard par
       wahi zyada kaam ka hai. */
    DECLARE @Ahead DATE = DATEADD(DAY, 30, @Today);

    SELECT
        (SELECT COUNT(*) FROM dbo.TableBookings
         WHERE BookingDate BETWEEN @FromDate AND @ToDate) AS TableBookingsInRange,
        (SELECT COUNT(*) FROM dbo.HallBookings
         WHERE EventDate BETWEEN @FromDate AND @ToDate) AS HallBookingsInRange,

        (SELECT COUNT(*) FROM dbo.TableBookings
         WHERE BookingDate BETWEEN @Today AND @Ahead
           AND Status IN ('PENDING','CONFIRMED')) AS UpcomingTableBookings,
        (SELECT COUNT(*) FROM dbo.HallBookings
         WHERE EventDate BETWEEN @Today AND @Ahead
           AND Status IN ('PENDING','CONFIRMED')) AS UpcomingHallBookings,

        (SELECT ISNULL(SUM(TotalAmount), 0) FROM dbo.HallBookings
         WHERE EventDate BETWEEN @Today AND @Ahead AND Status <> 'CANCELLED') AS UpcomingHallRevenue,
        (SELECT ISNULL(SUM(AdvanceAmount), 0) FROM dbo.HallBookings
         WHERE PaymentStatus = 'PAID') AS HallAdvanceCollected,
        (SELECT COUNT(*) FROM dbo.HallBookings
         WHERE EventType = N'Birthday' AND EventDate BETWEEN @Today AND @Ahead) AS UpcomingBirthdayEvents;
END
GO

/* -----------------------------------------------------------------
   usp_Dashboard_EmployeeStats : sirf apne assigned restaurants ka data
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Dashboard_EmployeeStats
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS DATE);

    DECLARE @Rest TABLE (RestaurantId INT PRIMARY KEY);
    INSERT INTO @Rest (RestaurantId)
    SELECT RestaurantId FROM dbo.RestaurantEmployees
    WHERE UserId = @UserId AND IsActive = 1;

    /* R1 KPI */
    SELECT
        (SELECT COUNT(*) FROM @Rest) AS AssignedRestaurants,
        (SELECT COUNT(*) FROM dbo.Orders o JOIN @Rest x ON x.RestaurantId = o.RestaurantId
         WHERE CAST(o.PlacedAt AS DATE) = @Today) AS TodayOrders,
        (SELECT ISNULL(SUM(o.TotalAmount), 0) FROM dbo.Orders o JOIN @Rest x ON x.RestaurantId = o.RestaurantId
         WHERE CAST(o.PlacedAt AS DATE) = @Today AND o.PaymentStatus = 'PAID') AS TodayRevenue,
        (SELECT COUNT(*) FROM dbo.Orders o JOIN @Rest x ON x.RestaurantId = o.RestaurantId
         WHERE o.Status IN ('PLACED','CONFIRMED','PREPARING','OUT_FOR_DELIVERY')) AS PendingOrders,
        (SELECT COUNT(*) FROM dbo.TableBookings t JOIN @Rest x ON x.RestaurantId = t.RestaurantId
         WHERE t.Status = 'PENDING') AS PendingTableBookings,
        (SELECT COUNT(*) FROM dbo.HallBookings h JOIN @Rest x ON x.RestaurantId = h.RestaurantId
         WHERE h.Status = 'PENDING') AS PendingHallBookings,
        (SELECT COUNT(*) FROM dbo.Orders o
         WHERE o.DeliveryEmployeeId = @UserId AND o.Status = 'OUT_FOR_DELIVERY') AS MyActiveDeliveries,
        (SELECT COUNT(*) FROM dbo.Orders o
         WHERE o.DeliveryEmployeeId = @UserId AND o.Status = 'DELIVERED') AS MyDeliveredOrders;

    /* R2 per-restaurant snapshot */
    SELECT r.RestaurantId, r.Name, r.ThumbnailUrl, r.Locality, r.City, r.Rating,
           re.Designation, re.CanManageMenu, re.CanManageOrder, re.CanManageBooking,
           (SELECT COUNT(*) FROM dbo.Orders o WHERE o.RestaurantId = r.RestaurantId
              AND o.Status IN ('PLACED','CONFIRMED','PREPARING','OUT_FOR_DELIVERY')) AS PendingOrders,
           (SELECT COUNT(*) FROM dbo.Orders o WHERE o.RestaurantId = r.RestaurantId
              AND CAST(o.PlacedAt AS DATE) = @Today) AS TodayOrders,
           (SELECT COUNT(*) FROM dbo.FoodItems fi WHERE fi.RestaurantId = r.RestaurantId
              AND fi.IsActive = 1 AND fi.IsAvailable = 0) AS OutOfStockItems
    FROM   dbo.RestaurantEmployees re
    JOIN   dbo.Restaurants r ON r.RestaurantId = re.RestaurantId
    WHERE  re.UserId = @UserId AND re.IsActive = 1
    ORDER BY r.Name;

    /* R3 aaj ke pending orders */
    SELECT TOP 20
           o.OrderId, o.OrderNumber, u.FullName AS CustomerName, u.Phone AS CustomerPhone,
           r.Name AS RestaurantName, o.TotalAmount, o.Status, o.PaymentMode,
           o.PaymentStatus, o.EtaMinutes, o.PlacedAt, o.DeliveryAddress, o.DistanceKm
    FROM   dbo.Orders o
    JOIN   @Rest x ON x.RestaurantId = o.RestaurantId
    JOIN   dbo.Users u ON u.UserId = o.UserId
    JOIN   dbo.Restaurants r ON r.RestaurantId = o.RestaurantId
    WHERE  o.Status IN ('PLACED','CONFIRMED','PREPARING','OUT_FOR_DELIVERY')
    ORDER BY o.PlacedAt;
END
GO

/* ======================= HOME PAGE FEED ======================= */

/* -----------------------------------------------------------------
   usp_Home_Sections
   R1 cuisines  R2 top rated  R3 nearby/promoted  R4 offers
   R5 testimonials  R6 counters  R7 cities
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Home_Sections
    @City    NVARCHAR(80)  = NULL,
    @UserLat DECIMAL(9,6)  = NULL,
    @UserLng DECIMAL(9,6)  = NULL
AS
BEGIN
    SET NOCOUNT ON;

    /* R1 cuisines */
    SELECT TOP 12 c.CuisineId, c.Name, c.IconUrl,
           (SELECT COUNT(*) FROM dbo.RestaurantCuisines rc
            JOIN dbo.Restaurants r ON r.RestaurantId = rc.RestaurantId AND r.IsActive = 1
            WHERE rc.CuisineId = c.CuisineId) AS RestaurantCount
    FROM   dbo.Cuisines c
    WHERE  c.IsActive = 1
    ORDER BY RestaurantCount DESC, c.Name;

    /* R2 top rated */
    SELECT TOP 12
           r.RestaurantId, r.Name, r.Slug, r.ThumbnailUrl, r.Locality, r.City,
           r.CostForTwo, r.Rating, r.TotalReviews, r.OpeningTime, r.ClosingTime,
           dbo.fn_IsRestaurantOpen(r.OpeningTime, r.ClosingTime) AS IsOpenNow,
           dbo.fn_MinutesToClose(r.OpeningTime, r.ClosingTime)   AS MinutesToClose,
           CASE WHEN @UserLat IS NULL THEN NULL
                ELSE dbo.fn_DistanceKm(@UserLat, @UserLng, r.Latitude, r.Longitude) END AS DistanceKm,
           (SELECT STRING_AGG(c.Name, N', ') WITHIN GROUP (ORDER BY c.Name)
            FROM dbo.RestaurantCuisines rc
            JOIN dbo.Cuisines c ON c.CuisineId = rc.CuisineId
            WHERE rc.RestaurantId = r.RestaurantId) AS CuisineNames
    FROM   dbo.Restaurants r
    WHERE  r.IsActive = 1 AND (@City IS NULL OR r.City = @City)
    ORDER BY r.Rating DESC, r.TotalReviews DESC;

    /* R3 promoted / nearby */
    SELECT TOP 12
           r.RestaurantId, r.Name, r.Slug, r.ThumbnailUrl, r.Locality, r.City,
           r.CostForTwo, r.Rating, r.TotalReviews,
           dbo.fn_IsRestaurantOpen(r.OpeningTime, r.ClosingTime) AS IsOpenNow,
           dbo.fn_MinutesToClose(r.OpeningTime, r.ClosingTime)   AS MinutesToClose,
           CASE WHEN @UserLat IS NULL THEN NULL
                ELSE dbo.fn_DistanceKm(@UserLat, @UserLng, r.Latitude, r.Longitude) END AS DistanceKm,
           (SELECT STRING_AGG(c.Name, N', ') WITHIN GROUP (ORDER BY c.Name)
            FROM dbo.RestaurantCuisines rc
            JOIN dbo.Cuisines c ON c.CuisineId = rc.CuisineId
            WHERE rc.RestaurantId = r.RestaurantId) AS CuisineNames
    FROM   dbo.Restaurants r
    WHERE  r.IsActive = 1 AND (@City IS NULL OR r.City = @City)
    ORDER BY r.IsPromoted DESC,
             CASE WHEN @UserLat IS NULL THEN NULL
                  ELSE dbo.fn_DistanceKm(@UserLat, @UserLng, r.Latitude, r.Longitude) END ASC,
             r.Rating DESC;

    /* R4 live offers */
    SELECT TOP 8 cp.CouponId, cp.Code, cp.Title, cp.Description, cp.DiscountType,
           cp.DiscountValue, cp.MaxDiscountAmount, cp.MinOrderAmount, cp.ValidTo,
           r.Name AS RestaurantName, r.Slug AS RestaurantSlug
    FROM   dbo.Coupons cp
    LEFT JOIN dbo.Restaurants r ON r.RestaurantId = cp.RestaurantId
    WHERE  cp.IsActive = 1 AND SYSUTCDATETIME() BETWEEN cp.ValidFrom AND cp.ValidTo
    ORDER BY cp.DiscountValue DESC;

    /* R5 happy customers */
    SELECT TOP 12 TestimonialId, CustomerName, CustomerImage, City, Designation,
           Rating, Message
    FROM   dbo.Testimonials
    WHERE  IsActive = 1
    ORDER BY DisplayOrder, CreatedAt DESC;

    /* R6 counters */
    SELECT
        (SELECT COUNT(*) FROM dbo.Restaurants WHERE IsActive = 1) AS RestaurantCount,
        (SELECT COUNT(*) FROM dbo.Orders WHERE Status = 'DELIVERED') AS DeliveredOrderCount,
        (SELECT COUNT(DISTINCT UserId) FROM dbo.Orders) AS HappyCustomerCount,
        (SELECT COUNT(*) FROM dbo.Cuisines WHERE IsActive = 1) AS CuisineCount,
        (SELECT CAST(ISNULL(AVG(Rating), 0) AS DECIMAL(3,2)) FROM dbo.Reviews WHERE IsApproved = 1) AS AvgRating,
        (SELECT COUNT(*) FROM dbo.Reviews WHERE IsApproved = 1) AS ReviewCount;

    /* R7 cities */
    SELECT City, COUNT(*) AS RestaurantCount
    FROM   dbo.Restaurants WHERE IsActive = 1
    GROUP BY City ORDER BY RestaurantCount DESC;
END
GO

/* ========================= APP SETTINGS ======================= */
CREATE PROCEDURE dbo.usp_Setting_GetAll
AS
BEGIN
    SET NOCOUNT ON;
    SELECT SettingKey, SettingValue, Description FROM dbo.AppSettings ORDER BY SettingKey;
END
GO

CREATE PROCEDURE dbo.usp_Setting_Save
    @SettingKey   NVARCHAR(80),
    @SettingValue NVARCHAR(500),
    @Description  NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.AppSettings WHERE SettingKey = @SettingKey)
        UPDATE dbo.AppSettings
        SET SettingValue = @SettingValue, Description = ISNULL(@Description, Description)
        WHERE SettingKey = @SettingKey;
    ELSE
        INSERT INTO dbo.AppSettings (SettingKey, SettingValue, Description)
        VALUES (@SettingKey, @SettingValue, @Description);

    SELECT @SettingKey AS SettingKey, @SettingValue AS SettingValue;
END
GO

PRINT 'Admin / Review / Dashboard stored procedures created.';
GO
