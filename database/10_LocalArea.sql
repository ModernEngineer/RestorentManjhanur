/* ============================================================
   10_LocalArea.sql
   ------------------------------------------------------------
   Demo restaurants aur addresses ko aapke delivery area
   (Kaushambi, UP) me le aata hai.

   Ye zaroori hai kyunki seed data Delhi NCR ka hai - aur agar
   restaurant Delhi me ho aur customer Kaushambi me, to distance
   600+ km aata hai aur kuch bhi deliverable nahi hota.

   >>> COORDINATES PLACEHOLDER HAIN <<<
   Neeche @CenterLat / @CenterLng aapki dukaan ki asli location se
   badal do - saare restaurants usi ke aas paas shift ho jayenge.
   Frontend me bhi wahi center src/context/deliveryAreas.ts me hai,
   dono jagah same rakhna.
   ============================================================ */
USE ZomatoCloneDb;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

SET NOCOUNT ON;

DECLARE @CenterLat DECIMAL(9,6) = 25.530000;   -- <-- apni dukaan ka latitude
DECLARE @CenterLng DECIMAL(9,6) = 81.380000;   -- <-- apni dukaan ka longitude
DECLARE @City      NVARCHAR(80) = N'Kaushambi';
DECLARE @Pincode   NVARCHAR(10) = N'212207';

PRINT 'Restaurants ko delivery area me shift kar rahe hain...';

/* ---------------- restaurants ----------------
   Sab center ke 1 km ke andar rakhe hain, taaki customer ki doori
   wahi rahe jo aapne batayi hai.
   -------------------------------------------- */
UPDATE r
SET    r.Latitude  = x.Lat,
       r.Longitude = x.Lng,
       r.Locality  = x.Locality,
       r.City      = @City,
       r.Pincode   = @Pincode,
       r.DeliveryRadiusKm = 15.00,
       r.UpdatedAt = SYSUTCDATETIME()
FROM   dbo.Restaurants r
JOIN   (VALUES
    (N'kwality-spice-house-connaught-place', N'Osa', 25.532535, 81.381023),
    (N'biryani-bandi-karol-bagh', N'Pata', 25.528770, 81.383746),
    (N'tandoori-tales-saket', N'Diha Salempur', 25.525775, 81.378296),
    (N'dakshin-tiffin-room-hauz-khas', N'Mawai Kewat', 25.531538, 81.375317),
    (N'6-bay-leaf-bengali-kitchen-malviya-nagar', N'Chak Aureha', 25.532698, 81.385179),
    (N'wok-republic-cyber-hub', N'Faridpur', 25.525327, 81.382990),
    (N'napoli-craft-pizzeria-sector-18-noida', N'Gaura', 25.526852, 81.373958),
    (N'burger-garage-rajouri-garden', N'Kurron', 25.535452, 81.376512),
    (N'cafe-chaupal-lajpat-nagar', N'Bhandesar', 25.530627, 81.387943),
    (N'marwari-rasoi-dwarka', N'Osa', 25.522833, 81.380695),
    (N'open-tap-brewhouse-golf-course-road', N'Pata', 25.529294, 81.371064),
    (N'royal-darbar-banquet-indirapuram', N'Sarai Aqil', 25.537971, 81.381558)
) AS x(Slug, Locality, Lat, Lng) ON x.Slug = r.Slug;

PRINT '  restaurants updated: ' + CAST(@@ROWCOUNT AS varchar(10));

/* ---------------- demo customer addresses ----------------
   Alag alag doori par rakhe hain taaki saare delivery slabs
   test ho jayein (Rs 20 / 30 / 40 / 65 / 90).
   --------------------------------------------------------- */
UPDATE a
SET    a.Latitude    = x.Lat,
       a.Longitude   = x.Lng,
       a.City        = @City,
       a.Pincode     = @Pincode,
       a.AddressLine = x.Village + N', ' + @City
FROM   dbo.UserAddresses a
JOIN   dbo.Users u ON u.UserId = a.UserId
JOIN   (VALUES
    (N'ananya@example.com', N'Home', N'Pata', 25.538451, 81.383409),
    (N'ananya@example.com', N'Work', N'Faridpur', 25.520497, 81.357420),
    (N'vikram@example.com', N'Home', N'Tewa', 25.551516, 81.445569),
    (N'meera@example.com', N'Home', N'Nara', 25.440410, 81.371320),
    (N'rohit@example.com', N'Home', N'Kaushambi', 25.414714, 81.453680),
    (N'fatima@example.com', N'Home', N'Diha Salempur', 25.540316, 81.396329),
    (N'sanjay@example.com', N'Home', N'Karari', 25.574941, 81.293657)
) AS x(Email, Label, Village, Lat, Lng)
  ON x.Email = u.Email AND x.Label = a.Label;

PRINT '  addresses updated: ' + CAST(@@ROWCOUNT AS varchar(10));

/* ---------------- settings ---------------- */
UPDATE dbo.AppSettings SET SettingValue = @City       WHERE SettingKey = N'DefaultCity';
UPDATE dbo.AppSettings SET SettingValue = N'15'       WHERE SettingKey = N'MaxDeliveryRadiusKm';
GO

/* ---------------- check: kaunsa address kis slab me hai ---------------- */
PRINT '';
PRINT 'Delivery charge check (center wale restaurant se):';

SELECT TOP 20
       u.FullName                                   AS Customer,
       a.AddressLine                                AS Address,
       dbo.fn_DistanceKm(a.Latitude, a.Longitude,
                         r.Latitude, r.Longitude)   AS DistanceKm,
       dbo.fn_DeliveryFee(
           dbo.fn_DistanceKm(a.Latitude, a.Longitude,
                             r.Latitude, r.Longitude)) AS DeliveryCharge
FROM   dbo.UserAddresses a
JOIN   dbo.Users u ON u.UserId = a.UserId
CROSS APPLY (SELECT TOP 1 * FROM dbo.Restaurants
             WHERE Slug = N'biryani-bandi-karol-bagh') r
WHERE  a.IsActive = 1
ORDER BY DistanceKm;
GO

PRINT '';
PRINT 'Ho gaya. Ab website par order karke dekho - delivery charge distance ke hisaab se lagega.';
GO
