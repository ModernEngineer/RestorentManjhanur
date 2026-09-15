/* ============================================================
   ZomatoClone - Stored Procedures : Restaurants / Search / Filters
   ============================================================ */
USE ZomatoCloneDb;
GO

/* XML/STRING_AGG aur indexed views ke liye ye settings ON chahiye.
   sqlcmd default me QUOTED_IDENTIFIER OFF rakhta hai, isliye explicit. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.usp_Restaurant_Search','P')      IS NOT NULL DROP PROCEDURE dbo.usp_Restaurant_Search;
IF OBJECT_ID('dbo.usp_Restaurant_GetDetail','P')   IS NOT NULL DROP PROCEDURE dbo.usp_Restaurant_GetDetail;
IF OBJECT_ID('dbo.usp_Restaurant_Save','P')        IS NOT NULL DROP PROCEDURE dbo.usp_Restaurant_Save;
IF OBJECT_ID('dbo.usp_Restaurant_ToggleActive','P')IS NOT NULL DROP PROCEDURE dbo.usp_Restaurant_ToggleActive;
IF OBJECT_ID('dbo.usp_Restaurant_UpdateImages','P')IS NOT NULL DROP PROCEDURE dbo.usp_Restaurant_UpdateImages;
IF OBJECT_ID('dbo.usp_Restaurant_ListForAdmin','P')IS NOT NULL DROP PROCEDURE dbo.usp_Restaurant_ListForAdmin;
IF OBJECT_ID('dbo.usp_Cuisine_List','P')           IS NOT NULL DROP PROCEDURE dbo.usp_Cuisine_List;
IF OBJECT_ID('dbo.usp_Locality_List','P')          IS NOT NULL DROP PROCEDURE dbo.usp_Locality_List;
IF OBJECT_ID('dbo.usp_CheckDeliverable','P')       IS NOT NULL DROP PROCEDURE dbo.usp_CheckDeliverable;
GO

/* -----------------------------------------------------------------
   usp_Restaurant_Search
   Zomato jaise saare filters + distance + pagination.
   @UserLat/@UserLng diye to distance nikal kar 15 km (ya restaurant
   ke apne DeliveryRadiusKm) ke andar wale hi dikhte hain jab
   @OnlyDeliverable = 1.

   Har row me COUNT(*) OVER() ke through TotalCount aata hai, isliye
   alag count query ki zaroorat nahi.
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Restaurant_Search
    @Search           NVARCHAR(150)  = NULL,   -- name / cuisine / locality text
    @City             NVARCHAR(80)   = NULL,
    @Locality         NVARCHAR(120)  = NULL,
    @CuisineIds       NVARCHAR(200)  = NULL,   -- CSV: '1,4,7'
    @MinRating        DECIMAL(3,2)   = NULL,   -- 4.5 => "Rating: 4.5+"
    @MaxCostForTwo    DECIMAL(10,2)  = NULL,
    @MinCostForTwo    DECIMAL(10,2)  = NULL,
    @PureVegOnly      BIT            = 0,
    @OutdoorSeating   BIT            = 0,
    @PetFriendly      BIT            = 0,
    @ServesAlcohol    BIT            = 0,
    @OpenNow          BIT            = 0,
    @HasOffers        BIT            = 0,
    @HasTableBooking  BIT            = 0,
    @HasHallBooking   BIT            = 0,
    @UserLat          DECIMAL(9,6)   = NULL,
    @UserLng          DECIMAL(9,6)   = NULL,
    @MaxDistanceKm    DECIMAL(6,2)   = NULL,   -- NULL => restaurant ka apna radius
    @OnlyDeliverable  BIT            = 0,
    @SortBy           NVARCHAR(30)   = N'relevance',
                      -- relevance | rating | cost_low | cost_high | distance | popular | newest
    @PageNumber       INT            = 1,
    @PageSize         INT            = 12
AS
BEGIN
    SET NOCOUNT ON;

    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 12;
    IF @PageSize > 60 SET @PageSize = 60;

    DECLARE @CuisineFilter TABLE (CuisineId INT PRIMARY KEY);
    IF NULLIF(LTRIM(RTRIM(@CuisineIds)), N'') IS NOT NULL
        INSERT INTO @CuisineFilter (CuisineId)
        SELECT DISTINCT TRY_CAST(LTRIM(RTRIM(value)) AS INT)
        FROM   STRING_SPLIT(@CuisineIds, ',')
        WHERE  TRY_CAST(LTRIM(RTRIM(value)) AS INT) IS NOT NULL;

    DECLARE @HasCuisineFilter BIT = CASE WHEN EXISTS (SELECT 1 FROM @CuisineFilter) THEN 1 ELSE 0 END;

    ;WITH Base AS
    (
        SELECT
            r.RestaurantId,
            r.Name,
            r.Slug,
            r.Tagline,
            r.ThumbnailUrl,
            r.CoverImageUrl,
            r.AddressLine,
            r.Locality,
            r.City,
            r.Latitude,
            r.Longitude,
            r.CostForTwo,
            r.Rating,
            r.TotalReviews,
            r.OpeningTime,
            r.ClosingTime,
            r.DeliveryRadiusKm,
            r.AvgPrepTimeMin,
            r.IsPureVeg,
            r.HasOutdoorSeating,
            r.IsPetFriendly,
            r.ServesAlcohol,
            r.HasTableBooking,
            r.HasHallBooking,
            r.AcceptsOnlineOrder,
            r.IsPromoted,
            r.CreatedAt,
            dbo.fn_IsRestaurantOpen(r.OpeningTime, r.ClosingTime) AS IsOpenNow,
            dbo.fn_MinutesToClose(r.OpeningTime, r.ClosingTime)   AS MinutesToClose,
            CASE WHEN @UserLat IS NULL OR @UserLng IS NULL THEN NULL
                 ELSE dbo.fn_DistanceKm(@UserLat, @UserLng, r.Latitude, r.Longitude)
            END AS DistanceKm,
            (SELECT STRING_AGG(c.Name, N', ') WITHIN GROUP (ORDER BY c.Name)
             FROM   dbo.RestaurantCuisines rc
             JOIN   dbo.Cuisines c ON c.CuisineId = rc.CuisineId
             WHERE  rc.RestaurantId = r.RestaurantId) AS CuisineNames,
            (SELECT TOP 1 cp.Title
             FROM   dbo.Coupons cp
             WHERE  cp.IsActive = 1
               AND  cp.AppliesTo = 'ORDER'
               AND  SYSUTCDATETIME() BETWEEN cp.ValidFrom AND cp.ValidTo
               AND (cp.RestaurantId IS NULL OR cp.RestaurantId = r.RestaurantId)
             ORDER BY CASE WHEN cp.RestaurantId = r.RestaurantId THEN 0 ELSE 1 END,
                      cp.DiscountValue DESC) AS OfferText
        FROM dbo.Restaurants r
        WHERE r.IsActive = 1
          AND (@City     IS NULL OR r.City     = @City)
          AND (@Locality IS NULL OR r.Locality = @Locality)
          AND (@MinRating      IS NULL OR r.Rating     >= @MinRating)
          AND (@MaxCostForTwo  IS NULL OR r.CostForTwo <= @MaxCostForTwo)
          AND (@MinCostForTwo  IS NULL OR r.CostForTwo >= @MinCostForTwo)
          AND (@PureVegOnly     = 0 OR r.IsPureVeg         = 1)
          AND (@OutdoorSeating  = 0 OR r.HasOutdoorSeating = 1)
          AND (@PetFriendly     = 0 OR r.IsPetFriendly     = 1)
          AND (@ServesAlcohol   = 0 OR r.ServesAlcohol     = 1)
          AND (@HasTableBooking = 0 OR r.HasTableBooking   = 1)
          AND (@HasHallBooking  = 0 OR r.HasHallBooking    = 1)
          AND (NULLIF(LTRIM(RTRIM(@Search)), N'') IS NULL
               OR r.Name     LIKE N'%' + @Search + N'%'
               OR r.Locality LIKE N'%' + @Search + N'%'
               OR r.Tagline  LIKE N'%' + @Search + N'%'
               OR EXISTS (SELECT 1 FROM dbo.RestaurantCuisines rc
                          JOIN dbo.Cuisines c ON c.CuisineId = rc.CuisineId
                          WHERE rc.RestaurantId = r.RestaurantId
                            AND c.Name LIKE N'%' + @Search + N'%')
               OR EXISTS (SELECT 1 FROM dbo.FoodItems fi
                          WHERE fi.RestaurantId = r.RestaurantId
                            AND fi.IsActive = 1
                            AND fi.Name LIKE N'%' + @Search + N'%'))
          AND (@HasCuisineFilter = 0
               OR EXISTS (SELECT 1 FROM dbo.RestaurantCuisines rc
                          JOIN @CuisineFilter cf ON cf.CuisineId = rc.CuisineId
                          WHERE rc.RestaurantId = r.RestaurantId))
          AND (@HasOffers = 0
               OR EXISTS (SELECT 1 FROM dbo.Coupons cp
                          WHERE cp.IsActive = 1
                            AND SYSUTCDATETIME() BETWEEN cp.ValidFrom AND cp.ValidTo
                            AND (cp.RestaurantId IS NULL OR cp.RestaurantId = r.RestaurantId))
               OR EXISTS (SELECT 1 FROM dbo.FoodItems fi
                          WHERE fi.RestaurantId = r.RestaurantId
                            AND fi.IsActive = 1 AND fi.DiscountPrice IS NOT NULL))
    ),
    Filtered AS
    (
        SELECT b.*,
               CASE WHEN b.DistanceKm IS NULL THEN CAST(1 AS BIT)
                    WHEN b.DistanceKm <= ISNULL(@MaxDistanceKm, b.DeliveryRadiusKm) THEN CAST(1 AS BIT)
                    ELSE CAST(0 AS BIT)
               END AS IsDeliverable,
               dbo.fn_DeliveryFee(b.DistanceKm) AS DeliveryFee
        FROM   Base b
        WHERE (@OpenNow = 0 OR b.IsOpenNow = 1)
          AND (@OnlyDeliverable = 0
               OR b.DistanceKm IS NULL
               OR b.DistanceKm <= ISNULL(@MaxDistanceKm, b.DeliveryRadiusKm))
          AND (@MaxDistanceKm IS NULL OR b.DistanceKm IS NULL OR b.DistanceKm <= @MaxDistanceKm)
    ),
    Counted AS
    (
        SELECT f.*, COUNT(*) OVER() AS TotalCount
        FROM   Filtered f
    )
    SELECT *,
           CASE WHEN DistanceKm IS NULL THEN NULL
                ELSE AvgPrepTimeMin + CEILING(DistanceKm * 3)
           END AS EtaMinutes
    FROM   Counted
    ORDER BY
        /* Conditional sort: chosen key ke liye CASE value deta hai, baaki
           rows ke liye NULL (sab equal) - isliye sirf ek key effect karti hai. */
        CASE WHEN @SortBy = N'rating'    THEN Rating       END DESC,
        CASE WHEN @SortBy = N'cost_low'  THEN CostForTwo   END ASC,
        CASE WHEN @SortBy = N'cost_high' THEN CostForTwo   END DESC,
        CASE WHEN @SortBy = N'distance'  THEN DistanceKm   END ASC,
        CASE WHEN @SortBy = N'popular'   THEN TotalReviews END DESC,
        CASE WHEN @SortBy = N'newest'    THEN CreatedAt    END DESC,
        IsPromoted DESC, Rating DESC, TotalReviews DESC, RestaurantId ASC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* -----------------------------------------------------------------
   usp_Restaurant_GetDetail
   R1 : restaurant  R2 : cuisines  R3 : categories  R4 : food items
   R5 : top reviews R6 : halls     R7 : active offers
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Restaurant_GetDetail
    @RestaurantId INT          = NULL,
    @Slug         NVARCHAR(180) = NULL,
    @UserLat      DECIMAL(9,6) = NULL,
    @UserLng      DECIMAL(9,6) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RestaurantId IS NULL AND @Slug IS NOT NULL
        SELECT @RestaurantId = RestaurantId FROM dbo.Restaurants WHERE Slug = @Slug;

    IF @RestaurantId IS NULL
    BEGIN
        SELECT TOP 0 CAST(NULL AS INT) AS RestaurantId;
        RETURN;
    END

    /* R1 */
    SELECT  r.*,
            dbo.fn_IsRestaurantOpen(r.OpeningTime, r.ClosingTime) AS IsOpenNow,
            dbo.fn_MinutesToClose(r.OpeningTime, r.ClosingTime)   AS MinutesToClose,
            CASE WHEN @UserLat IS NULL THEN NULL
                 ELSE dbo.fn_DistanceKm(@UserLat, @UserLng, r.Latitude, r.Longitude)
            END AS DistanceKm,
            dbo.fn_DeliveryFee(
                CASE WHEN @UserLat IS NULL THEN NULL
                     ELSE dbo.fn_DistanceKm(@UserLat, @UserLng, r.Latitude, r.Longitude)
                END) AS DeliveryFee,
            CASE WHEN @UserLat IS NULL THEN CAST(1 AS BIT)
                 WHEN dbo.fn_DistanceKm(@UserLat, @UserLng, r.Latitude, r.Longitude) <= r.DeliveryRadiusKm
                      THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT)
            END AS IsDeliverable
    FROM    dbo.Restaurants r
    WHERE   r.RestaurantId = @RestaurantId;

    /* R2 cuisines */
    SELECT c.CuisineId, c.Name
    FROM   dbo.RestaurantCuisines rc
    JOIN   dbo.Cuisines c ON c.CuisineId = rc.CuisineId
    WHERE  rc.RestaurantId = @RestaurantId
    ORDER BY c.Name;

    /* R3 categories */
    SELECT fc.CategoryId, fc.Name, fc.DisplayOrder,
           (SELECT COUNT(*) FROM dbo.FoodItems fi
            WHERE fi.CategoryId = fc.CategoryId AND fi.RestaurantId = @RestaurantId AND fi.IsActive = 1) AS ItemCount
    FROM   dbo.FoodCategories fc
    WHERE  fc.IsActive = 1
      AND (fc.RestaurantId = @RestaurantId OR fc.RestaurantId IS NULL)
      AND  EXISTS (SELECT 1 FROM dbo.FoodItems fi
                   WHERE fi.CategoryId = fc.CategoryId
                     AND fi.RestaurantId = @RestaurantId AND fi.IsActive = 1)
    ORDER BY fc.DisplayOrder, fc.Name;

    /* R4 food items */
    SELECT fi.FoodItemId, fi.RestaurantId, fi.CategoryId, fc.Name AS CategoryName,
           fi.Name, fi.Description, fi.Price, fi.DiscountPrice,
           CAST(ISNULL(fi.DiscountPrice, fi.Price) AS DECIMAL(10,2)) AS EffectivePrice,
           CASE WHEN fi.DiscountPrice IS NULL THEN 0
                ELSE CAST(ROUND((fi.Price - fi.DiscountPrice) * 100.0 / fi.Price, 0) AS INT)
           END AS DiscountPercent,
           fi.ImageUrl, fi.IsVeg, fi.IsBestseller, fi.IsAvailable,
           fi.Rating, fi.TotalReviews, fi.ServesCount, fi.DisplayOrder
    FROM   dbo.FoodItems fi
    LEFT JOIN dbo.FoodCategories fc ON fc.CategoryId = fi.CategoryId
    WHERE  fi.RestaurantId = @RestaurantId AND fi.IsActive = 1
    ORDER BY fc.DisplayOrder, fi.DisplayOrder, fi.Name;

    /* R5 reviews (top 20) */
    SELECT TOP 20
           rv.ReviewId, rv.UserId, u.FullName AS UserName, u.ProfileImage AS UserImage,
           rv.Rating, rv.FoodRating, rv.ServiceRating, rv.Title, rv.Comment,
           rv.ImageUrl, rv.LikeCount, rv.CreatedAt
    FROM   dbo.Reviews rv
    JOIN   dbo.Users u ON u.UserId = rv.UserId
    WHERE  rv.RestaurantId = @RestaurantId AND rv.IsApproved = 1
    ORDER BY rv.CreatedAt DESC;

    /* R6 halls */
    SELECT h.HallId, h.Name, h.Description, h.MinCapacity, h.MaxCapacity,
           h.PricePerPlate, h.BaseRent, h.ImageUrl, h.GalleryJson, h.AmenitiesJson,
           h.HasAC, h.HasParking, h.HasDJ
    FROM   dbo.Halls h
    WHERE  h.RestaurantId = @RestaurantId AND h.IsActive = 1
    ORDER BY h.MaxCapacity;

    /* R7 active offers */
    SELECT cp.CouponId, cp.Code, cp.Title, cp.Description, cp.DiscountType,
           cp.DiscountValue, cp.MaxDiscountAmount, cp.MinOrderAmount,
           cp.AppliesTo, cp.ValidTo
    FROM   dbo.Coupons cp
    WHERE  cp.IsActive = 1
      AND  SYSUTCDATETIME() BETWEEN cp.ValidFrom AND cp.ValidTo
      AND (cp.RestaurantId IS NULL OR cp.RestaurantId = @RestaurantId)
    ORDER BY CASE WHEN cp.RestaurantId = @RestaurantId THEN 0 ELSE 1 END, cp.DiscountValue DESC;

    /* R8 rating breakdown */
    SELECT CAST(ROUND(rv.Rating, 0) AS INT) AS Stars, COUNT(*) AS CountOfReviews
    FROM   dbo.Reviews rv
    WHERE  rv.RestaurantId = @RestaurantId AND rv.IsApproved = 1
    GROUP BY CAST(ROUND(rv.Rating, 0) AS INT)
    ORDER BY Stars DESC;
END
GO

/* -----------------------------------------------------------------
   usp_Restaurant_Save  (insert + update, admin panel)
   @CuisineIds CSV ko bhi sync karta hai.
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Restaurant_Save
    @RestaurantId       INT            = 0,
    @Name               NVARCHAR(150),
    @Slug               NVARCHAR(180)  = NULL,
    @Tagline            NVARCHAR(250)  = NULL,
    @Description        NVARCHAR(MAX)  = NULL,
    @ThumbnailUrl       NVARCHAR(500)  = NULL,
    @CoverImageUrl      NVARCHAR(500)  = NULL,
    @AddressLine        NVARCHAR(300),
    @Locality           NVARCHAR(120),
    @City               NVARCHAR(80),
    @Pincode            NVARCHAR(10)   = NULL,
    @Latitude           DECIMAL(9,6),
    @Longitude          DECIMAL(9,6),
    @Phone              NVARCHAR(20)   = NULL,
    @CostForTwo         DECIMAL(10,2)  = 500,
    @OpeningTime        TIME(0)        = '11:00',
    @ClosingTime        TIME(0)        = '23:00',
    @DeliveryRadiusKm   DECIMAL(5,2)   = 15.00,
    @AvgPrepTimeMin     INT            = 30,
    @IsPureVeg          BIT            = 0,
    @HasOutdoorSeating  BIT            = 0,
    @IsPetFriendly      BIT            = 0,
    @ServesAlcohol      BIT            = 0,
    @HasTableBooking    BIT            = 1,
    @HasHallBooking     BIT            = 0,
    @AcceptsOnlineOrder BIT            = 1,
    @IsPromoted         BIT            = 0,
    @IsActive           BIT            = 1,
    @CuisineIds         NVARCHAR(200)  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@Slug)), N'') IS NULL
        SET @Slug = LOWER(REPLACE(REPLACE(REPLACE(@Name, N' ', N'-'), N'&', N'and'), N'''', N''))
                  + N'-' + LOWER(REPLACE(@Locality, N' ', N'-'));

    BEGIN TRAN;

    IF @RestaurantId IS NULL OR @RestaurantId = 0
    BEGIN
        /* slug unique rakho */
        IF EXISTS (SELECT 1 FROM dbo.Restaurants WHERE Slug = @Slug)
            SET @Slug = @Slug + N'-' + CAST(ABS(CHECKSUM(NEWID())) % 9999 AS NVARCHAR(10));

        INSERT INTO dbo.Restaurants
            (Name, Slug, Tagline, Description, ThumbnailUrl, CoverImageUrl, AddressLine,
             Locality, City, Pincode, Latitude, Longitude, Phone, CostForTwo,
             OpeningTime, ClosingTime, DeliveryRadiusKm, AvgPrepTimeMin, IsPureVeg,
             HasOutdoorSeating, IsPetFriendly, ServesAlcohol, HasTableBooking,
             HasHallBooking, AcceptsOnlineOrder, IsPromoted, IsActive)
        VALUES
            (@Name, @Slug, @Tagline, @Description, @ThumbnailUrl, @CoverImageUrl, @AddressLine,
             @Locality, @City, @Pincode, @Latitude, @Longitude, @Phone, @CostForTwo,
             @OpeningTime, @ClosingTime, @DeliveryRadiusKm, @AvgPrepTimeMin, @IsPureVeg,
             @HasOutdoorSeating, @IsPetFriendly, @ServesAlcohol, @HasTableBooking,
             @HasHallBooking, @AcceptsOnlineOrder, @IsPromoted, @IsActive);

        SET @RestaurantId = CAST(SCOPE_IDENTITY() AS INT);
    END
    ELSE
    BEGIN
        UPDATE dbo.Restaurants
        SET Name = @Name, Slug = @Slug, Tagline = @Tagline, Description = @Description,
            ThumbnailUrl = ISNULL(@ThumbnailUrl, ThumbnailUrl),
            CoverImageUrl = ISNULL(@CoverImageUrl, CoverImageUrl),
            AddressLine = @AddressLine, Locality = @Locality, City = @City, Pincode = @Pincode,
            Latitude = @Latitude, Longitude = @Longitude, Phone = @Phone,
            CostForTwo = @CostForTwo, OpeningTime = @OpeningTime, ClosingTime = @ClosingTime,
            DeliveryRadiusKm = @DeliveryRadiusKm, AvgPrepTimeMin = @AvgPrepTimeMin,
            IsPureVeg = @IsPureVeg, HasOutdoorSeating = @HasOutdoorSeating,
            IsPetFriendly = @IsPetFriendly, ServesAlcohol = @ServesAlcohol,
            HasTableBooking = @HasTableBooking, HasHallBooking = @HasHallBooking,
            AcceptsOnlineOrder = @AcceptsOnlineOrder, IsPromoted = @IsPromoted,
            IsActive = @IsActive, UpdatedAt = SYSUTCDATETIME()
        WHERE RestaurantId = @RestaurantId;
    END

    /* cuisines sync */
    IF @CuisineIds IS NOT NULL
    BEGIN
        DELETE FROM dbo.RestaurantCuisines WHERE RestaurantId = @RestaurantId;

        INSERT INTO dbo.RestaurantCuisines (RestaurantId, CuisineId)
        SELECT DISTINCT @RestaurantId, TRY_CAST(LTRIM(RTRIM(value)) AS INT)
        FROM   STRING_SPLIT(@CuisineIds, ',')
        WHERE  TRY_CAST(LTRIM(RTRIM(value)) AS INT) IS NOT NULL
          AND  EXISTS (SELECT 1 FROM dbo.Cuisines c
                       WHERE c.CuisineId = TRY_CAST(LTRIM(RTRIM(value)) AS INT));
    END

    COMMIT TRAN;

    SELECT @RestaurantId AS RestaurantId, @Slug AS Slug;
END
GO

/* -----------------------------------------------------------------
   usp_Restaurant_UpdateImages  (admin panel se image badalna)
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Restaurant_UpdateImages
    @RestaurantId  INT,
    @ThumbnailUrl  NVARCHAR(500) = NULL,
    @CoverImageUrl NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Restaurants
    SET    ThumbnailUrl  = ISNULL(@ThumbnailUrl,  ThumbnailUrl),
           CoverImageUrl = ISNULL(@CoverImageUrl, CoverImageUrl),
           UpdatedAt     = SYSUTCDATETIME()
    WHERE  RestaurantId = @RestaurantId;

    SELECT RestaurantId, ThumbnailUrl, CoverImageUrl
    FROM   dbo.Restaurants WHERE RestaurantId = @RestaurantId;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Restaurant_ToggleActive
    @RestaurantId INT,
    @IsActive     BIT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Restaurants
    SET IsActive = @IsActive, UpdatedAt = SYSUTCDATETIME()
    WHERE RestaurantId = @RestaurantId;

    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

/* -----------------------------------------------------------------
   usp_Restaurant_ListForAdmin
   Admin sab dekhta hai; Employee ko sirf assigned restaurants.
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Restaurant_ListForAdmin
    @Search        NVARCHAR(150) = NULL,
    @City          NVARCHAR(80)  = NULL,
    @IsActive      BIT           = NULL,
    @ForUserId     INT           = NULL,   -- employee filter
    @IsAdmin       BIT           = 1,
    @PageNumber    INT           = 1,
    @PageSize      INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   < 1 SET @PageSize   = 20;

    ;WITH Q AS
    (
        SELECT r.RestaurantId, r.Name, r.Slug, r.ThumbnailUrl, r.Locality, r.City,
               r.CostForTwo, r.Rating, r.TotalReviews, r.IsActive, r.IsPromoted,
               r.HasTableBooking, r.HasHallBooking, r.DeliveryRadiusKm,
               r.OpeningTime, r.ClosingTime, r.CreatedAt,
               (SELECT COUNT(*) FROM dbo.FoodItems fi WHERE fi.RestaurantId = r.RestaurantId AND fi.IsActive = 1) AS MenuItemCount,
               (SELECT COUNT(*) FROM dbo.Orders o     WHERE o.RestaurantId  = r.RestaurantId) AS OrderCount,
               (SELECT COUNT(*) FROM dbo.RestaurantEmployees re WHERE re.RestaurantId = r.RestaurantId AND re.IsActive = 1) AS EmployeeCount,
               COUNT(*) OVER() AS TotalCount
        FROM   dbo.Restaurants r
        WHERE (@IsActive IS NULL OR r.IsActive = @IsActive)
          AND (@City IS NULL OR r.City = @City)
          AND (NULLIF(LTRIM(RTRIM(@Search)), N'') IS NULL
               OR r.Name LIKE N'%' + @Search + N'%'
               OR r.Locality LIKE N'%' + @Search + N'%')
          AND (@IsAdmin = 1 OR @ForUserId IS NULL
               OR EXISTS (SELECT 1 FROM dbo.RestaurantEmployees re
                          WHERE re.RestaurantId = r.RestaurantId
                            AND re.UserId = @ForUserId AND re.IsActive = 1))
    )
    SELECT * FROM Q
    ORDER BY Name
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Cuisine_List
AS
BEGIN
    SET NOCOUNT ON;

    SELECT c.CuisineId, c.Name, c.IconUrl,
           (SELECT COUNT(*) FROM dbo.RestaurantCuisines rc
            JOIN dbo.Restaurants r ON r.RestaurantId = rc.RestaurantId AND r.IsActive = 1
            WHERE rc.CuisineId = c.CuisineId) AS RestaurantCount
    FROM   dbo.Cuisines c
    WHERE  c.IsActive = 1
    ORDER BY c.Name;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_Locality_List
    @City NVARCHAR(80) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT City, Locality, COUNT(*) AS RestaurantCount
    FROM   dbo.Restaurants
    WHERE  IsActive = 1 AND (@City IS NULL OR City = @City)
    GROUP BY City, Locality
    ORDER BY City, Locality;
END
GO

/* -----------------------------------------------------------------
   usp_CheckDeliverable : 15 km rule ka single-point check
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_CheckDeliverable
    @RestaurantId INT,
    @Lat          DECIMAL(9,6),
    @Lng          DECIMAL(9,6)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  r.RestaurantId,
            r.Name,
            r.DeliveryRadiusKm,
            dbo.fn_DistanceKm(@Lat, @Lng, r.Latitude, r.Longitude) AS DistanceKm,
            CASE WHEN dbo.fn_DistanceKm(@Lat, @Lng, r.Latitude, r.Longitude) <= r.DeliveryRadiusKm
                 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS IsDeliverable,
            dbo.fn_DeliveryFee(dbo.fn_DistanceKm(@Lat, @Lng, r.Latitude, r.Longitude)) AS DeliveryFee,
            r.AvgPrepTimeMin
                + CEILING(ISNULL(dbo.fn_DistanceKm(@Lat, @Lng, r.Latitude, r.Longitude), 0) * 3) AS EtaMinutes,
            dbo.fn_IsRestaurantOpen(r.OpeningTime, r.ClosingTime) AS IsOpenNow
    FROM    dbo.Restaurants r
    WHERE   r.RestaurantId = @RestaurantId;
END
GO

PRINT 'Restaurant stored procedures created.';
GO
