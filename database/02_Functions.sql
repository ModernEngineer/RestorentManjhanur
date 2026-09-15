/* ============================================================
   ZomatoClone - Scalar / Table Valued Functions
   ============================================================ */
USE ZomatoCloneDb;
GO

/* XML/STRING_AGG aur indexed views ke liye ye settings ON chahiye.
   sqlcmd default me QUOTED_IDENTIFIER OFF rakhta hai, isliye explicit. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.fn_DistanceKm','FN')        IS NOT NULL DROP FUNCTION dbo.fn_DistanceKm;
IF OBJECT_ID('dbo.fn_DeliveryFee','FN')       IS NOT NULL DROP FUNCTION dbo.fn_DeliveryFee;
IF OBJECT_ID('dbo.fn_IsRestaurantOpen','FN')  IS NOT NULL DROP FUNCTION dbo.fn_IsRestaurantOpen;
IF OBJECT_ID('dbo.fn_MinutesToClose','FN')    IS NOT NULL DROP FUNCTION dbo.fn_MinutesToClose;
IF OBJECT_ID('dbo.fn_NextSequenceNumber','FN') IS NOT NULL DROP FUNCTION dbo.fn_NextSequenceNumber;
GO

/* ------------------------------------------------------------------
   fn_DistanceKm : Haversine distance (km) between two lat/long points
   geography::STDistance ka use karte hain - SQL Server native, accurate.
   ------------------------------------------------------------------ */
CREATE FUNCTION dbo.fn_DistanceKm
(
    @Lat1 DECIMAL(9,6),
    @Lng1 DECIMAL(9,6),
    @Lat2 DECIMAL(9,6),
    @Lng2 DECIMAL(9,6)
)
RETURNS DECIMAL(9,2)
AS
BEGIN
    IF @Lat1 IS NULL OR @Lng1 IS NULL OR @Lat2 IS NULL OR @Lng2 IS NULL
        RETURN NULL;

    DECLARE @p1 GEOGRAPHY = GEOGRAPHY::Point(@Lat1, @Lng1, 4326);
    DECLARE @p2 GEOGRAPHY = GEOGRAPHY::Point(@Lat2, @Lng2, 4326);

    RETURN CAST(@p1.STDistance(@p2) / 1000.0 AS DECIMAL(9,2));
END
GO

/* ------------------------------------------------------------------
   fn_DeliveryFee : distance ke hisaab se delivery charge

     0  - 1 km   ->  Rs 20
     1  - 3 km   ->  Rs 30
     3  - 5 km   ->  Rs 40
     5  - 10 km  ->  Rs 65
     10 - 15 km  ->  Rs 90
     > 15 km     ->  -1   (delivery range se bahar)

   Slab badalna ho to sirf yahi function edit karo aur
   02_Functions.sql dobara chala do - poore system me apne aap lag
   jayega (order create, checkout estimate, listing - sab yahi
   function use karte hain).
   ------------------------------------------------------------------ */
CREATE FUNCTION dbo.fn_DeliveryFee (@DistanceKm DECIMAL(9,2))
RETURNS DECIMAL(10,2)
AS
BEGIN
    -- distance pata hi nahi (pickup ya bina address) -> beech ka slab
    IF @DistanceKm IS NULL         RETURN 40.00;

    IF @DistanceKm > 15.00         RETURN -1.00;
    IF @DistanceKm <= 1.00         RETURN 20.00;
    IF @DistanceKm <= 3.00         RETURN 30.00;
    IF @DistanceKm <= 5.00         RETURN 40.00;
    IF @DistanceKm <= 10.00        RETURN 65.00;
    RETURN 90.00;
END
GO

/* ------------------------------------------------------------------
   fn_IsRestaurantOpen : IST (UTC+5:30) ke hisaab se open/closed
   Midnight-crossing hours (e.g. 18:00 - 02:00) bhi handle karta hai.
   ------------------------------------------------------------------ */
CREATE FUNCTION dbo.fn_IsRestaurantOpen (@Open TIME(0), @Close TIME(0))
RETURNS BIT
AS
BEGIN
    DECLARE @Now TIME(0) = CAST(DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS TIME(0));

    IF @Close > @Open
        RETURN CASE WHEN @Now >= @Open AND @Now < @Close THEN 1 ELSE 0 END;

    -- closing time next day me chali gayi
    RETURN CASE WHEN @Now >= @Open OR @Now < @Close THEN 1 ELSE 0 END;
END
GO

/* ------------------------------------------------------------------
   fn_MinutesToClose : "Closes in 16 minutes" badge ke liye.
   Agar band hai to NULL.
   ------------------------------------------------------------------ */
CREATE FUNCTION dbo.fn_MinutesToClose (@Open TIME(0), @Close TIME(0))
RETURNS INT
AS
BEGIN
    IF dbo.fn_IsRestaurantOpen(@Open, @Close) = 0 RETURN NULL;

    DECLARE @Now TIME(0) = CAST(DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS TIME(0));
    DECLARE @Mins INT = DATEDIFF(MINUTE, @Now, @Close);

    IF @Mins < 0 SET @Mins = @Mins + 1440;   -- midnight cross
    RETURN @Mins;
END
GO

/* ------------------------------------------------------------------
   fn_NextSequenceNumber : human-readable number, e.g. ORD-20260915-1001
   ------------------------------------------------------------------ */
CREATE FUNCTION dbo.fn_NextSequenceNumber (@Prefix NVARCHAR(10), @Id BIGINT)
RETURNS NVARCHAR(30)
AS
BEGIN
    RETURN @Prefix + N'-'
         + FORMAT(DATEADD(MINUTE, 330, SYSUTCDATETIME()), 'yyyyMMdd')
         + N'-' + CAST(@Id AS NVARCHAR(20));
END
GO

PRINT 'Functions created successfully.';
GO
