/* ============================================================
   ZomatoClone - Stored Procedures : Menu (Categories + Food Items)
   Food image change karne ka option bhi yahin hai.
   ============================================================ */
USE ZomatoCloneDb;
GO

/* XML/STRING_AGG aur indexed views ke liye ye settings ON chahiye.
   sqlcmd default me QUOTED_IDENTIFIER OFF rakhta hai, isliye explicit. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.usp_FoodCategory_Save','P')     IS NOT NULL DROP PROCEDURE dbo.usp_FoodCategory_Save;
IF OBJECT_ID('dbo.usp_FoodCategory_List','P')     IS NOT NULL DROP PROCEDURE dbo.usp_FoodCategory_List;
IF OBJECT_ID('dbo.usp_FoodCategory_Delete','P')   IS NOT NULL DROP PROCEDURE dbo.usp_FoodCategory_Delete;
IF OBJECT_ID('dbo.usp_FoodItem_Save','P')         IS NOT NULL DROP PROCEDURE dbo.usp_FoodItem_Save;
IF OBJECT_ID('dbo.usp_FoodItem_List','P')         IS NOT NULL DROP PROCEDURE dbo.usp_FoodItem_List;
IF OBJECT_ID('dbo.usp_FoodItem_GetById','P')      IS NOT NULL DROP PROCEDURE dbo.usp_FoodItem_GetById;
IF OBJECT_ID('dbo.usp_FoodItem_UpdateImage','P')  IS NOT NULL DROP PROCEDURE dbo.usp_FoodItem_UpdateImage;
IF OBJECT_ID('dbo.usp_FoodItem_ToggleAvailability','P') IS NOT NULL DROP PROCEDURE dbo.usp_FoodItem_ToggleAvailability;
IF OBJECT_ID('dbo.usp_FoodItem_Delete','P')       IS NOT NULL DROP PROCEDURE dbo.usp_FoodItem_Delete;
IF OBJECT_ID('dbo.usp_FoodItem_SetDiscount','P')  IS NOT NULL DROP PROCEDURE dbo.usp_FoodItem_SetDiscount;
IF OBJECT_ID('dbo.usp_FoodItem_Search','P')       IS NOT NULL DROP PROCEDURE dbo.usp_FoodItem_Search;
GO

/* ======================= CATEGORIES =========================== */
CREATE PROCEDURE dbo.usp_FoodCategory_Save
    @CategoryId   INT           = 0,
    @RestaurantId INT           = NULL,
    @Name         NVARCHAR(100),
    @DisplayOrder INT           = 0,
    @IsActive     BIT           = 1
AS
BEGIN
    SET NOCOUNT ON;

    IF @CategoryId IS NULL OR @CategoryId = 0
    BEGIN
        INSERT INTO dbo.FoodCategories (RestaurantId, Name, DisplayOrder, IsActive)
        VALUES (@RestaurantId, @Name, @DisplayOrder, @IsActive);

        SET @CategoryId = CAST(SCOPE_IDENTITY() AS INT);
    END
    ELSE
    BEGIN
        UPDATE dbo.FoodCategories
        SET    Name = @Name, DisplayOrder = @DisplayOrder, IsActive = @IsActive
        WHERE  CategoryId = @CategoryId;
    END

    SELECT @CategoryId AS CategoryId;
END
GO

CREATE PROCEDURE dbo.usp_FoodCategory_List
    @RestaurantId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT fc.CategoryId, fc.RestaurantId, fc.Name, fc.DisplayOrder, fc.IsActive,
           (SELECT COUNT(*) FROM dbo.FoodItems fi
            WHERE fi.CategoryId = fc.CategoryId AND fi.IsActive = 1
              AND (@RestaurantId IS NULL OR fi.RestaurantId = @RestaurantId)) AS ItemCount
    FROM   dbo.FoodCategories fc
    WHERE  fc.IsActive = 1
      AND (@RestaurantId IS NULL OR fc.RestaurantId = @RestaurantId OR fc.RestaurantId IS NULL)
    ORDER BY fc.DisplayOrder, fc.Name;
END
GO

CREATE PROCEDURE dbo.usp_FoodCategory_Delete
    @CategoryId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.FoodItems WHERE CategoryId = @CategoryId AND IsActive = 1)
    BEGIN
        SELECT -1 AS AffectedRows, N'Category me active items hain, pehle unhe move/delete karo.' AS Message;
        RETURN;
    END

    UPDATE dbo.FoodCategories SET IsActive = 0 WHERE CategoryId = @CategoryId;
    SELECT @@ROWCOUNT AS AffectedRows, N'Deleted' AS Message;
END
GO

/* ======================== FOOD ITEMS ========================== */
CREATE PROCEDURE dbo.usp_FoodItem_Save
    @FoodItemId    INT           = 0,
    @RestaurantId  INT,
    @CategoryId    INT           = NULL,
    @Name          NVARCHAR(150),
    @Description   NVARCHAR(600) = NULL,
    @Price         DECIMAL(10,2),
    @DiscountPrice DECIMAL(10,2) = NULL,
    @ImageUrl      NVARCHAR(500) = NULL,
    @IsVeg         BIT           = 1,
    @IsBestseller  BIT           = 0,
    @IsAvailable   BIT           = 1,
    @ServesCount   NVARCHAR(40)  = NULL,
    @DisplayOrder  INT           = 0,
    @IsActive      BIT           = 1
AS
BEGIN
    SET NOCOUNT ON;

    IF @DiscountPrice IS NOT NULL AND @DiscountPrice >= @Price
    BEGIN
        SELECT -1 AS FoodItemId, N'Discount price, price se kam honi chahiye.' AS Message;
        RETURN;
    END

    IF @FoodItemId IS NULL OR @FoodItemId = 0
    BEGIN
        INSERT INTO dbo.FoodItems
            (RestaurantId, CategoryId, Name, Description, Price, DiscountPrice, ImageUrl,
             IsVeg, IsBestseller, IsAvailable, ServesCount, DisplayOrder, IsActive)
        VALUES
            (@RestaurantId, @CategoryId, @Name, @Description, @Price, @DiscountPrice, @ImageUrl,
             @IsVeg, @IsBestseller, @IsAvailable, @ServesCount, @DisplayOrder, @IsActive);

        SET @FoodItemId = CAST(SCOPE_IDENTITY() AS INT);
    END
    ELSE
    BEGIN
        UPDATE dbo.FoodItems
        SET    CategoryId = @CategoryId, Name = @Name, Description = @Description,
               Price = @Price, DiscountPrice = @DiscountPrice,
               ImageUrl = ISNULL(@ImageUrl, ImageUrl),   -- image na bheji to purani rahegi
               IsVeg = @IsVeg, IsBestseller = @IsBestseller, IsAvailable = @IsAvailable,
               ServesCount = @ServesCount, DisplayOrder = @DisplayOrder,
               IsActive = @IsActive, UpdatedAt = SYSUTCDATETIME()
        WHERE  FoodItemId = @FoodItemId AND RestaurantId = @RestaurantId;
    END

    SELECT @FoodItemId AS FoodItemId, N'Saved' AS Message;
END
GO

/* -----------------------------------------------------------------
   usp_FoodItem_UpdateImage
   Admin panel ka "image change karo" button isi ko call karta hai.
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_FoodItem_UpdateImage
    @FoodItemId INT,
    @ImageUrl   NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.FoodItems
    SET    ImageUrl = @ImageUrl, UpdatedAt = SYSUTCDATETIME()
    WHERE  FoodItemId = @FoodItemId;

    SELECT FoodItemId, Name, ImageUrl, UpdatedAt
    FROM   dbo.FoodItems
    WHERE  FoodItemId = @FoodItemId;
END
GO

/* -----------------------------------------------------------------
   usp_FoodItem_List  (admin + public dono)
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_FoodItem_List
    @RestaurantId INT           = NULL,
    @CategoryId   INT           = NULL,
    @Search       NVARCHAR(150) = NULL,
    @VegOnly      BIT           = 0,
    @NonVegOnly   BIT           = 0,
    @Bestseller   BIT           = 0,
    @OnlyOffers   BIT           = 0,
    @MinPrice     DECIMAL(10,2) = NULL,
    @MaxPrice     DECIMAL(10,2) = NULL,
    @IncludeInactive BIT        = 0,
    @SortBy       NVARCHAR(20)  = N'default',  -- default | price_low | price_high | rating | name
    @PageNumber   INT           = 1,
    @PageSize     INT           = 50
AS
BEGIN
    SET NOCOUNT ON;

    IF @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   < 1 SET @PageSize   = 50;

    ;WITH Q AS
    (
        SELECT fi.FoodItemId, fi.RestaurantId, r.Name AS RestaurantName, r.Slug AS RestaurantSlug,
               fi.CategoryId, fc.Name AS CategoryName,
               fi.Name, fi.Description, fi.Price, fi.DiscountPrice,
               CAST(ISNULL(fi.DiscountPrice, fi.Price) AS DECIMAL(10,2)) AS EffectivePrice,
               CASE WHEN fi.DiscountPrice IS NULL THEN 0
                    ELSE CAST(ROUND((fi.Price - fi.DiscountPrice) * 100.0 / fi.Price, 0) AS INT)
               END AS DiscountPercent,
               fi.ImageUrl, fi.IsVeg, fi.IsBestseller, fi.IsAvailable, fi.Rating,
               fi.TotalReviews, fi.ServesCount, fi.DisplayOrder, fi.IsActive,
               fi.CreatedAt, fi.UpdatedAt,
               COUNT(*) OVER() AS TotalCount
        FROM   dbo.FoodItems fi
        JOIN   dbo.Restaurants r ON r.RestaurantId = fi.RestaurantId
        LEFT JOIN dbo.FoodCategories fc ON fc.CategoryId = fi.CategoryId
        WHERE (@IncludeInactive = 1 OR fi.IsActive = 1)
          AND (@RestaurantId IS NULL OR fi.RestaurantId = @RestaurantId)
          AND (@CategoryId   IS NULL OR fi.CategoryId   = @CategoryId)
          AND (@VegOnly    = 0 OR fi.IsVeg = 1)
          AND (@NonVegOnly = 0 OR fi.IsVeg = 0)
          AND (@Bestseller = 0 OR fi.IsBestseller = 1)
          AND (@OnlyOffers = 0 OR fi.DiscountPrice IS NOT NULL)
          AND (@MinPrice IS NULL OR ISNULL(fi.DiscountPrice, fi.Price) >= @MinPrice)
          AND (@MaxPrice IS NULL OR ISNULL(fi.DiscountPrice, fi.Price) <= @MaxPrice)
          AND (NULLIF(LTRIM(RTRIM(@Search)), N'') IS NULL
               OR fi.Name LIKE N'%' + @Search + N'%'
               OR fi.Description LIKE N'%' + @Search + N'%')
    )
    SELECT * FROM Q
    ORDER BY
        CASE WHEN @SortBy = N'price_low'  THEN EffectivePrice END ASC,
        CASE WHEN @SortBy = N'price_high' THEN EffectivePrice END DESC,
        CASE WHEN @SortBy = N'rating'     THEN Rating         END DESC,
        CASE WHEN @SortBy = N'name'       THEN Name           END ASC,
        DisplayOrder, FoodItemId
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

CREATE PROCEDURE dbo.usp_FoodItem_GetById
    @FoodItemId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT fi.*, r.Name AS RestaurantName, r.Slug AS RestaurantSlug,
           fc.Name AS CategoryName,
           CAST(ISNULL(fi.DiscountPrice, fi.Price) AS DECIMAL(10,2)) AS EffectivePrice
    FROM   dbo.FoodItems fi
    JOIN   dbo.Restaurants r ON r.RestaurantId = fi.RestaurantId
    LEFT JOIN dbo.FoodCategories fc ON fc.CategoryId = fi.CategoryId
    WHERE  fi.FoodItemId = @FoodItemId;
END
GO

CREATE PROCEDURE dbo.usp_FoodItem_ToggleAvailability
    @FoodItemId  INT,
    @IsAvailable BIT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.FoodItems
    SET    IsAvailable = @IsAvailable, UpdatedAt = SYSUTCDATETIME()
    WHERE  FoodItemId = @FoodItemId;

    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

CREATE PROCEDURE dbo.usp_FoodItem_Delete
    @FoodItemId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- soft delete: purane orders ke references bache rahein
    UPDATE dbo.FoodItems
    SET    IsActive = 0, IsAvailable = 0, UpdatedAt = SYSUTCDATETIME()
    WHERE  FoodItemId = @FoodItemId;

    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

/* -----------------------------------------------------------------
   usp_FoodItem_SetDiscount
   Ek item ya poore restaurant/category par ek saath % discount.
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_FoodItem_SetDiscount
    @FoodItemId      INT = NULL,
    @RestaurantId    INT = NULL,
    @CategoryId      INT = NULL,
    @DiscountPercent DECIMAL(5,2),      -- 0 => discount hata do
    @MaxPrice        DECIMAL(10,2) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @FoodItemId IS NULL AND @RestaurantId IS NULL
    BEGIN
        SELECT -1 AS AffectedRows, N'FoodItemId ya RestaurantId me se ek zaroori hai.' AS Message;
        RETURN;
    END

    IF @DiscountPercent < 0 OR @DiscountPercent >= 100
    BEGIN
        SELECT -1 AS AffectedRows, N'Discount 0 se 99 ke beech hona chahiye.' AS Message;
        RETURN;
    END

    UPDATE dbo.FoodItems
    SET    DiscountPrice = CASE WHEN @DiscountPercent = 0 THEN NULL
                                ELSE CAST(ROUND(Price * (1 - @DiscountPercent / 100.0), 2) AS DECIMAL(10,2))
                           END,
           UpdatedAt = SYSUTCDATETIME()
    WHERE  IsActive = 1
      AND (@FoodItemId   IS NULL OR FoodItemId   = @FoodItemId)
      AND (@RestaurantId IS NULL OR RestaurantId = @RestaurantId)
      AND (@CategoryId   IS NULL OR CategoryId   = @CategoryId)
      AND (@MaxPrice     IS NULL OR Price       <= @MaxPrice);

    SELECT @@ROWCOUNT AS AffectedRows, N'Discount applied' AS Message;
END
GO

/* -----------------------------------------------------------------
   usp_FoodItem_Search : global dish search (home page search bar)
   ----------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_FoodItem_Search
    @Search  NVARCHAR(150),
    @City    NVARCHAR(80)  = NULL,
    @UserLat DECIMAL(9,6)  = NULL,
    @UserLng DECIMAL(9,6)  = NULL,
    @TopN    INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (@TopN)
           fi.FoodItemId, fi.Name, fi.ImageUrl, fi.Price, fi.DiscountPrice,
           CAST(ISNULL(fi.DiscountPrice, fi.Price) AS DECIMAL(10,2)) AS EffectivePrice,
           fi.IsVeg, fi.Rating,
           r.RestaurantId, r.Name AS RestaurantName, r.Slug AS RestaurantSlug,
           r.Locality, r.City, r.Rating AS RestaurantRating,
           CASE WHEN @UserLat IS NULL THEN NULL
                ELSE dbo.fn_DistanceKm(@UserLat, @UserLng, r.Latitude, r.Longitude)
           END AS DistanceKm
    FROM   dbo.FoodItems fi
    JOIN   dbo.Restaurants r ON r.RestaurantId = fi.RestaurantId AND r.IsActive = 1
    WHERE  fi.IsActive = 1 AND fi.IsAvailable = 1
      AND (@City IS NULL OR r.City = @City)
      AND  fi.Name LIKE N'%' + @Search + N'%'
    ORDER BY fi.IsBestseller DESC, fi.Rating DESC, r.Rating DESC;
END
GO

PRINT 'Menu stored procedures created.';
GO
