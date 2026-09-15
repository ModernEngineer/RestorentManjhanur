/* ============================================================
   ZomatoClone - Seed / Demo Data
   ------------------------------------------------------------
   NOTE: Restaurant names yahan FICTIONAL hain (kisi real business
   ke naam par fake rating/review na lage). Localities aur
   lat/long approximate demo values hain - production me apna
   real data daalna.

   Password hash: neeche @Pwd me BCrypt hash hai jo API project ke
   scripts/GenerateHash se generate hua hai. Sabhi demo users ka
   password:  Pass@123
   ============================================================ */
USE ZomatoCloneDb;
GO

/* XML/STRING_AGG aur indexed views ke liye ye settings ON chahiye.
   sqlcmd default me QUOTED_IDENTIFIER OFF rakhta hai, isliye explicit. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

SET NOCOUNT ON;

DECLARE @Pwd NVARCHAR(400) = N'$2a$12$nNFy8jMrXVg95RBiCxQnJ.uC8Wm42s.k/RSsdNP0LnawAYjy1LGpa';

/* ============================ ROLES =========================== */
IF NOT EXISTS (SELECT 1 FROM dbo.Roles)
INSERT INTO dbo.Roles (RoleName, Description) VALUES
 (N'Admin',    N'Poora system control - restaurants, employees, coupons, reports'),
 (N'Employee', N'Sirf assigned restaurants ka order/menu/booking management'),
 (N'Customer', N'Order, table booking, hall booking, review');
GO

DECLARE @Pwd NVARCHAR(400) = N'$2a$12$nNFy8jMrXVg95RBiCxQnJ.uC8Wm42s.k/RSsdNP0LnawAYjy1LGpa';

/* ============================ USERS =========================== */
DECLARE @AdminRole INT = (SELECT RoleId FROM dbo.Roles WHERE RoleName = N'Admin');
DECLARE @EmpRole   INT = (SELECT RoleId FROM dbo.Roles WHERE RoleName = N'Employee');
DECLARE @CustRole  INT = (SELECT RoleId FROM dbo.Roles WHERE RoleName = N'Customer');

IF NOT EXISTS (SELECT 1 FROM dbo.Users)
BEGIN
    INSERT INTO dbo.Users (FullName, Email, Phone, PasswordHash, RoleId, ProfileImage) VALUES
    /* --- Admin --- */
    (N'Super Admin',     N'admin@foodmitra.in',    N'9810000001', @Pwd, @AdminRole, NULL),

    /* --- Employees --- */
    (N'Rahul Verma',     N'rahul.emp@foodmitra.in',  N'9810000011', @Pwd, @EmpRole, NULL),
    (N'Sneha Kapoor',    N'sneha.emp@foodmitra.in',  N'9810000012', @Pwd, @EmpRole, NULL),
    (N'Imran Sheikh',    N'imran.emp@foodmitra.in',  N'9810000013', @Pwd, @EmpRole, NULL),
    (N'Deepak Yadav',    N'deepak.emp@foodmitra.in', N'9810000014', @Pwd, @EmpRole, NULL),
    (N'Priya Nair',      N'priya.emp@foodmitra.in',  N'9810000015', @Pwd, @EmpRole, NULL),
    (N'Arjun Mehta',     N'arjun.emp@foodmitra.in',  N'9810000016', @Pwd, @EmpRole, NULL),

    /* --- Customers --- */
    (N'Ananya Sharma',   N'ananya@example.com',    N'9820000001', @Pwd, @CustRole, NULL),
    (N'Vikram Singh',    N'vikram@example.com',    N'9820000002', @Pwd, @CustRole, NULL),
    (N'Meera Iyer',      N'meera@example.com',     N'9820000003', @Pwd, @CustRole, NULL),
    (N'Rohit Bansal',    N'rohit@example.com',     N'9820000004', @Pwd, @CustRole, NULL),
    (N'Fatima Khan',     N'fatima@example.com',    N'9820000005', @Pwd, @CustRole, NULL),
    (N'Sanjay Gupta',    N'sanjay@example.com',    N'9820000006', @Pwd, @CustRole, NULL);
END
GO

/* ========================== CUISINES ========================== */
IF NOT EXISTS (SELECT 1 FROM dbo.Cuisines)
INSERT INTO dbo.Cuisines (Name) VALUES
 (N'North Indian'), (N'South Indian'), (N'Chinese'), (N'Mughlai'), (N'Bengali'),
 (N'Italian'), (N'Continental'), (N'Fast Food'), (N'Street Food'), (N'BBQ'),
 (N'Desserts'), (N'Beverages'), (N'Biryani'), (N'Pizza'), (N'Burger'),
 (N'Finger Food'), (N'Cafe'), (N'Thai'), (N'Punjabi'), (N'Rajasthani');
GO

/* ========================= RESTAURANTS ========================
   Delhi NCR localities (approximate coordinates - demo data)
   ============================================================== */
IF NOT EXISTS (SELECT 1 FROM dbo.Restaurants)
INSERT INTO dbo.Restaurants
 (Name, Slug, Tagline, Description, ThumbnailUrl, CoverImageUrl, AddressLine, Locality, City,
  Pincode, Latitude, Longitude, Phone, CostForTwo, Rating, TotalReviews, OpeningTime, ClosingTime,
  DeliveryRadiusKm, AvgPrepTimeMin, IsPureVeg, HasOutdoorSeating, IsPetFriendly, ServesAlcohol,
  HasTableBooking, HasHallBooking, IsPromoted)
VALUES
 (N'Kwality Spice House', N'kwality-spice-house-connaught-place',
  N'Legendary North Indian since 1975',
  N'Connaught Place ka iconic spot - rich Mughlai gravies, sizzling BBQ platters aur classic butter chicken.',
  N'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=75',
  N'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1600&q=75',
  N'B-12, Inner Circle, Connaught Place', N'Connaught Place', N'New Delhi',
  N'110001', 28.631500, 77.216700, N'01141234567', 4000, 4.60, 2840, '11:00', '23:30',
  15.00, 35, 0, 1, 0, 1, 1, 1, 1),

 (N'6 Bay Leaf Bengali Kitchen', N'6-bay-leaf-bengali-kitchen-malviya-nagar',
  N'Authentic Kolkata flavours',
  N'Shorshe ilish, kosha mangsho aur mishti doi - poora Bengal Malviya Nagar me.',
  N'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&q=75',
  N'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=1600&q=75',
  N'A-7, Main Market, Malviya Nagar', N'Malviya Nagar', N'New Delhi',
  N'110017', 28.535500, 77.211000, N'01141234568', 3000, 4.60, 1620, '12:00', '23:00',
  15.00, 40, 0, 0, 0, 0, 1, 1, 0),

 (N'Open Tap Brewhouse', N'open-tap-brewhouse-golf-course-road',
  N'Craft beer + finger food',
  N'Gurgaon ka favourite rooftop brewhouse - fresh craft beer, wood-fired pizza aur live music.',
  N'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=75',
  N'https://images.unsplash.com/photo-1436076863939-06870fe779c2?w=1600&q=75',
  N'Tower B, Golf Course Road, Sector 42', N'Golf Course Road', N'Gurgaon',
  N'122002', 28.459500, 77.073000, N'01244123456', 2500, 4.60, 3120, '12:00', '01:00',
  15.00, 30, 0, 1, 1, 1, 1, 1, 1),

 (N'Dakshin Tiffin Room', N'dakshin-tiffin-room-hauz-khas',
  N'Pure veg South Indian',
  N'Crispy ghee roast dosa, filter coffee aur Chettinad thali - sab pure veg.',
  N'https://images.unsplash.com/photo-1630383249896-424e482df921?w=800&q=75',
  N'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=1600&q=75',
  N'12, Hauz Khas Village', N'Hauz Khas', N'New Delhi',
  N'110016', 28.549400, 77.200100, N'01141234569', 700, 4.40, 980, '08:00', '22:30',
  12.00, 25, 1, 1, 0, 0, 1, 0, 0),

 (N'Tandoori Tales', N'tandoori-tales-saket',
  N'Charcoal grill specialists',
  N'Smoky kebabs, tandoori platters aur Punjabi curries - family dining ke liye perfect.',
  N'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&q=75',
  N'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=1600&q=75',
  N'Select City Walk Annex, Saket', N'Saket', N'New Delhi',
  N'110017', 28.524500, 77.206600, N'01141234570', 1800, 4.30, 1450, '11:30', '23:30',
  15.00, 35, 0, 1, 0, 1, 1, 1, 0),

 (N'Wok Republic', N'wok-republic-cyber-hub',
  N'Pan-Asian street style',
  N'Hakka noodles, dim sum baskets aur Thai curries - Cyber Hub ka quick Asian fix.',
  N'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&q=75',
  N'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=1600&q=75',
  N'Ground Floor, Cyber Hub, DLF Phase 2', N'Cyber Hub', N'Gurgaon',
  N'122002', 28.495000, 77.089000, N'01244123457', 1400, 4.20, 2210, '11:00', '23:00',
  15.00, 25, 0, 0, 0, 1, 1, 0, 1),

 (N'Napoli Craft Pizzeria', N'napoli-craft-pizzeria-sector-18-noida',
  N'Wood-fired Neapolitan pizza',
  N'48-hour fermented dough, San Marzano sauce aur imported buffalo mozzarella.',
  N'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=75',
  N'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=1600&q=75',
  N'The Great India Place, Sector 18', N'Sector 18', N'Noida',
  N'201301', 28.570000, 77.321000, N'01204123456', 1200, 4.50, 1870, '11:00', '23:00',
  15.00, 28, 0, 1, 1, 0, 1, 0, 0),

 (N'Biryani Bandi', N'biryani-bandi-karol-bagh',
  N'Dum biryani, Hyderabadi style',
  N'Handi dum biryani, mirchi ka salan aur double ka meetha - Karol Bagh ka hidden gem.',
  N'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=75',
  N'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=1600&q=75',
  N'23/4, Ajmal Khan Road, Karol Bagh', N'Karol Bagh', N'New Delhi',
  N'110005', 28.651900, 77.190900, N'01141234571', 900, 4.40, 3410, '11:00', '00:30',
  15.00, 30, 0, 0, 0, 0, 1, 0, 1),

 (N'Cafe Chaupal', N'cafe-chaupal-lajpat-nagar',
  N'Work-friendly cafe',
  N'Slow-brew coffee, all-day breakfast aur free WiFi - laptop wale log yahin milte hain.',
  N'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=75',
  N'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&q=75',
  N'M-Block Market, Lajpat Nagar II', N'Lajpat Nagar', N'New Delhi',
  N'110024', 28.567700, 77.243300, N'01141234572', 800, 4.10, 760, '08:00', '23:00',
  10.00, 20, 1, 1, 1, 0, 1, 0, 0),

 (N'Marwari Rasoi', N'marwari-rasoi-dwarka',
  N'Rajasthani thali house',
  N'Dal baati churma, gatte ki sabzi aur unlimited thali - pure veg, ghar jaisa khana.',
  N'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=75',
  N'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=1600&q=75',
  N'Sector 12 Market, Dwarka', N'Dwarka', N'New Delhi',
  N'110078', 28.592100, 77.046000, N'01141234573', 600, 4.30, 1120, '11:00', '22:30',
  15.00, 30, 1, 0, 0, 0, 1, 1, 0),

 (N'Burger Garage', N'burger-garage-rajouri-garden',
  N'Smash burgers + loaded fries',
  N'Double smash patty, house sauce aur thick shakes - late night tak khula.',
  N'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=75',
  N'https://images.unsplash.com/photo-1550547660-d9450f859349?w=1600&q=75',
  N'J-Block, Rajouri Garden', N'Rajouri Garden', N'New Delhi',
  N'110027', 28.646900, 77.120000, N'01141234574', 700, 4.20, 2050, '12:00', '02:00',
  15.00, 22, 0, 0, 0, 0, 0, 0, 0),

 (N'Royal Darbar Banquet', N'royal-darbar-banquet-indirapuram',
  N'Banquet + fine dining',
  N'Birthday, anniversary aur corporate events ke liye 3 halls - 20 se 400 guests tak.',
  N'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&q=75',
  N'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1600&q=75',
  N'Shakti Khand 4, Indirapuram', N'Indirapuram', N'Ghaziabad',
  N'201014', 28.645000, 77.371000, N'01204123457', 2200, 4.50, 890, '10:00', '23:30',
  15.00, 45, 0, 1, 0, 1, 1, 1, 1);
GO

/* =================== RESTAURANT <-> CUISINES ================== */
IF NOT EXISTS (SELECT 1 FROM dbo.RestaurantCuisines)
BEGIN
    INSERT INTO dbo.RestaurantCuisines (RestaurantId, CuisineId)
    SELECT r.RestaurantId, c.CuisineId
    FROM   dbo.Restaurants r
    JOIN   dbo.Cuisines c ON 1 = 1
    WHERE  (r.Slug = N'kwality-spice-house-connaught-place'      AND c.Name IN (N'North Indian', N'Mughlai', N'BBQ'))
       OR  (r.Slug = N'6-bay-leaf-bengali-kitchen-malviya-nagar' AND c.Name IN (N'Bengali', N'North Indian'))
       OR  (r.Slug = N'open-tap-brewhouse-golf-course-road'      AND c.Name IN (N'Finger Food', N'Continental', N'Italian', N'Beverages'))
       OR  (r.Slug = N'dakshin-tiffin-room-hauz-khas'            AND c.Name IN (N'South Indian', N'Beverages'))
       OR  (r.Slug = N'tandoori-tales-saket'                     AND c.Name IN (N'North Indian', N'Punjabi', N'BBQ', N'Mughlai'))
       OR  (r.Slug = N'wok-republic-cyber-hub'                   AND c.Name IN (N'Chinese', N'Thai', N'Fast Food'))
       OR  (r.Slug = N'napoli-craft-pizzeria-sector-18-noida'    AND c.Name IN (N'Italian', N'Pizza', N'Continental'))
       OR  (r.Slug = N'biryani-bandi-karol-bagh'                 AND c.Name IN (N'Biryani', N'Mughlai', N'Street Food'))
       OR  (r.Slug = N'cafe-chaupal-lajpat-nagar'                AND c.Name IN (N'Cafe', N'Continental', N'Desserts', N'Beverages'))
       OR  (r.Slug = N'marwari-rasoi-dwarka'                     AND c.Name IN (N'Rajasthani', N'North Indian'))
       OR  (r.Slug = N'burger-garage-rajouri-garden'             AND c.Name IN (N'Burger', N'Fast Food', N'Desserts'))
       OR  (r.Slug = N'royal-darbar-banquet-indirapuram'         AND c.Name IN (N'North Indian', N'Mughlai', N'Chinese', N'Desserts'));
END
GO

/* ====================== FOOD CATEGORIES ======================= */
IF NOT EXISTS (SELECT 1 FROM dbo.FoodCategories)
INSERT INTO dbo.FoodCategories (RestaurantId, Name, DisplayOrder) VALUES
 (NULL, N'Recommended',  1),
 (NULL, N'Starters',     2),
 (NULL, N'Main Course',  3),
 (NULL, N'Breads',       4),
 (NULL, N'Rice & Biryani', 5),
 (NULL, N'Pizza',        6),
 (NULL, N'Burgers',      7),
 (NULL, N'Desserts',     8),
 (NULL, N'Beverages',    9),
 (NULL, N'Combos',      10);
GO

/* ========================= FOOD ITEMS ========================= */
IF NOT EXISTS (SELECT 1 FROM dbo.FoodItems)
BEGIN
    DECLARE @Rec  INT = (SELECT CategoryId FROM dbo.FoodCategories WHERE Name = N'Recommended'     AND RestaurantId IS NULL);
    DECLARE @Str  INT = (SELECT CategoryId FROM dbo.FoodCategories WHERE Name = N'Starters'        AND RestaurantId IS NULL);
    DECLARE @Main INT = (SELECT CategoryId FROM dbo.FoodCategories WHERE Name = N'Main Course'     AND RestaurantId IS NULL);
    DECLARE @Brd  INT = (SELECT CategoryId FROM dbo.FoodCategories WHERE Name = N'Breads'          AND RestaurantId IS NULL);
    DECLARE @Rice INT = (SELECT CategoryId FROM dbo.FoodCategories WHERE Name = N'Rice & Biryani'  AND RestaurantId IS NULL);
    DECLARE @Pizz INT = (SELECT CategoryId FROM dbo.FoodCategories WHERE Name = N'Pizza'           AND RestaurantId IS NULL);
    DECLARE @Burg INT = (SELECT CategoryId FROM dbo.FoodCategories WHERE Name = N'Burgers'         AND RestaurantId IS NULL);
    DECLARE @Des  INT = (SELECT CategoryId FROM dbo.FoodCategories WHERE Name = N'Desserts'        AND RestaurantId IS NULL);
    DECLARE @Bev  INT = (SELECT CategoryId FROM dbo.FoodCategories WHERE Name = N'Beverages'       AND RestaurantId IS NULL);

    DECLARE @R1 INT = (SELECT RestaurantId FROM dbo.Restaurants WHERE Slug = N'kwality-spice-house-connaught-place');
    DECLARE @R2 INT = (SELECT RestaurantId FROM dbo.Restaurants WHERE Slug = N'6-bay-leaf-bengali-kitchen-malviya-nagar');
    DECLARE @R3 INT = (SELECT RestaurantId FROM dbo.Restaurants WHERE Slug = N'open-tap-brewhouse-golf-course-road');
    DECLARE @R4 INT = (SELECT RestaurantId FROM dbo.Restaurants WHERE Slug = N'dakshin-tiffin-room-hauz-khas');
    DECLARE @R5 INT = (SELECT RestaurantId FROM dbo.Restaurants WHERE Slug = N'tandoori-tales-saket');
    DECLARE @R6 INT = (SELECT RestaurantId FROM dbo.Restaurants WHERE Slug = N'wok-republic-cyber-hub');
    DECLARE @R7 INT = (SELECT RestaurantId FROM dbo.Restaurants WHERE Slug = N'napoli-craft-pizzeria-sector-18-noida');
    DECLARE @R8 INT = (SELECT RestaurantId FROM dbo.Restaurants WHERE Slug = N'biryani-bandi-karol-bagh');
    DECLARE @R9 INT = (SELECT RestaurantId FROM dbo.Restaurants WHERE Slug = N'cafe-chaupal-lajpat-nagar');
    DECLARE @R10 INT = (SELECT RestaurantId FROM dbo.Restaurants WHERE Slug = N'marwari-rasoi-dwarka');
    DECLARE @R11 INT = (SELECT RestaurantId FROM dbo.Restaurants WHERE Slug = N'burger-garage-rajouri-garden');
    DECLARE @R12 INT = (SELECT RestaurantId FROM dbo.Restaurants WHERE Slug = N'royal-darbar-banquet-indirapuram');

    INSERT INTO dbo.FoodItems
      (RestaurantId, CategoryId, Name, Description, Price, DiscountPrice, ImageUrl,
       IsVeg, IsBestseller, Rating, TotalReviews, ServesCount, DisplayOrder)
    VALUES
    /* ---- R1 Kwality Spice House ---- */
    (@R1, @Rec,  N'Butter Chicken',        N'Tandoori chicken in silky tomato-butter gravy, finished with cream.',      620, 549, N'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&q=75', 0, 1, 4.70, 820, N'Serves 2', 1),
    (@R1, @Rec,  N'Dal Makhani',           N'Slow-cooked black lentils, 8 hours on low flame.',                         420, NULL, N'https://images.unsplash.com/photo-1626500155537-5e5b0ba8ad5a?w=600&q=75', 1, 1, 4.60, 540, N'Serves 2', 2),
    (@R1, @Str,  N'Tandoori Chicken Full', N'Charcoal-grilled with yoghurt and kashmiri chilli marinade.',              680, 599, N'https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?w=600&q=75', 0, 1, 4.50, 410, N'Serves 3', 3),
    (@R1, @Str,  N'Paneer Tikka Angara',   N'Smoked cottage cheese cubes with bell peppers.',                           460, NULL, N'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&q=75', 1, 0, 4.40, 290, N'Serves 2', 4),
    (@R1, @Main, N'Mutton Rogan Josh',     N'Kashmiri style mutton curry with fennel and dry ginger.',                  780, NULL, N'https://images.unsplash.com/photo-1545247181-516773cae754?w=600&q=75', 0, 0, 4.50, 210, N'Serves 2', 5),
    (@R1, @Brd,  N'Garlic Butter Naan',    N'Tandoor naan with garlic and fresh coriander.',                             90, NULL, N'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600&q=75', 1, 0, 4.60, 620, N'Serves 1', 6),
    (@R1, @Des,  N'Gulab Jamun (2 pcs)',   N'Warm khoya dumplings in cardamom syrup.',                                  160, NULL, N'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=75', 1, 0, 4.30, 180, N'Serves 1', 7),

    /* ---- R2 Bengali ---- */
    (@R2, @Rec,  N'Kosha Mangsho',         N'Slow-cooked Bengali mutton curry, dark and spicy.',                        520, 469, N'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&q=75', 0, 1, 4.70, 380, N'Serves 2', 1),
    (@R2, @Rec,  N'Shorshe Ilish',         N'Hilsa fish in mustard gravy - seasonal special.',                           680, NULL, N'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&q=75', 0, 1, 4.60, 240, N'Serves 1', 2),
    (@R2, @Str,  N'Mochar Chop (2 pcs)',   N'Banana blossom croquettes, crisp fried.',                                  180, NULL, N'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=75', 1, 0, 4.20, 110, N'Serves 1', 3),
    (@R2, @Main, N'Chingri Malaikari',     N'Prawns in coconut milk gravy.',                                            620, NULL, N'https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=600&q=75', 0, 0, 4.50, 160, N'Serves 2', 4),
    (@R2, @Des,  N'Mishti Doi',            N'Clay-pot set sweet yoghurt.',                                              120, NULL, N'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=600&q=75', 1, 1, 4.80, 320, N'Serves 1', 5),

    /* ---- R3 Open Tap Brewhouse ---- */
    (@R3, @Rec,  N'Peri Peri Chicken Wings', N'8 pcs, tossed in house peri peri, blue cheese dip.',                     420, 379, N'https://images.unsplash.com/photo-1608039755401-742074f0548d?w=600&q=75', 0, 1, 4.50, 640, N'Serves 2', 1),
    (@R3, @Rec,  N'Loaded Nachos',           N'Cheese sauce, jalapenos, salsa, sour cream.',                            360, NULL, N'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=600&q=75', 1, 1, 4.40, 480, N'Serves 2', 2),
    (@R3, @Str,  N'Crispy Corn Chilli',      N'Golden fried corn tossed with chilli and curry leaf.',                   290, NULL, N'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&q=75', 1, 0, 4.30, 220, N'Serves 1', 3),
    (@R3, @Pizz, N'BBQ Chicken Pizza 12in',  N'BBQ sauce base, smoked chicken, red onion, mozzarella.',                 520, 449, N'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=75', 0, 0, 4.40, 310, N'Serves 2', 4),
    (@R3, @Bev,  N'Craft Wheat Beer Pint',   N'House-brewed Belgian style wheat beer.',                                 320, NULL, N'https://images.unsplash.com/photo-1436076863939-06870fe779c2?w=600&q=75', 1, 1, 4.60, 890, N'Serves 1', 5),

    /* ---- R4 Dakshin Tiffin ---- */
    (@R4, @Rec,  N'Ghee Roast Masala Dosa', N'Crisp dosa with extra ghee, potato masala, chutney and sambar.',          180, 159, N'https://images.unsplash.com/photo-1630383249896-424e482df921?w=600&q=75', 1, 1, 4.60, 720, N'Serves 1', 1),
    (@R4, @Rec,  N'Idli Sambar (3 pcs)',    N'Steamed idli with sambar and two chutneys.',                              110, NULL, N'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=75', 1, 1, 4.50, 610, N'Serves 1', 2),
    (@R4, @Main, N'Chettinad Veg Thali',    N'12-item unlimited thali with rice, sambar, rasam, poriyal, payasam.',     320, NULL, N'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&q=75', 1, 0, 4.40, 340, N'Serves 1', 3),
    (@R4, @Bev,  N'Filter Coffee',          N'Traditional davara-tumbler filter kaapi.',                                  70, NULL, N'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600&q=75', 1, 1, 4.70, 880, N'Serves 1', 4),

    /* ---- R5 Tandoori Tales ---- */
    (@R5, @Rec,  N'Mixed Grill Platter',   N'Chicken tikka, seekh kebab, fish tikka, malai tikka.',                     780, 699, N'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&q=75', 0, 1, 4.50, 520, N'Serves 3', 1),
    (@R5, @Str,  N'Afghani Malai Tikka',   N'Cream cheese marinade, mildly spiced.',                                    440, NULL, N'https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?w=600&q=75', 0, 0, 4.40, 260, N'Serves 2', 2),
    (@R5, @Main, N'Kadhai Paneer',         N'Cottage cheese with bell pepper in kadhai masala.',                        420, 379, N'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&q=75', 1, 0, 4.30, 300, N'Serves 2', 3),
    (@R5, @Brd,  N'Laccha Paratha',        N'Layered whole wheat tandoori paratha.',                                     80, NULL, N'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600&q=75', 1, 0, 4.40, 240, N'Serves 1', 4),

    /* ---- R6 Wok Republic ---- */
    (@R6, @Rec,  N'Chicken Hakka Noodles', N'Wok-tossed noodles with shredded chicken and veggies.',                    280, 249, N'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&q=75', 0, 1, 4.30, 690, N'Serves 1', 1),
    (@R6, @Rec,  N'Veg Dim Sum Basket',    N'6 pcs steamed dumplings with chilli oil.',                                 240, NULL, N'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=600&q=75', 1, 1, 4.40, 520, N'Serves 1', 2),
    (@R6, @Main, N'Thai Green Curry',      N'Coconut green curry with vegetables, steamed rice included.',              340, NULL, N'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=600&q=75', 1, 0, 4.20, 280, N'Serves 1', 3),
    (@R6, @Str,  N'Chilli Garlic Prawns',  N'Wok-fried prawns in chilli garlic sauce.',                                 420, NULL, N'https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=600&q=75', 0, 0, 4.40, 190, N'Serves 1', 4),

    /* ---- R7 Napoli Pizzeria ---- */
    (@R7, @Pizz, N'Margherita 12in',       N'San Marzano tomato, fior di latte, fresh basil.',                          420, 379, N'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=75', 1, 1, 4.60, 760, N'Serves 2', 1),
    (@R7, @Pizz, N'Diavola 12in',          N'Spicy salami, chilli flakes, mozzarella.',                                 540, NULL, N'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=75', 0, 1, 4.50, 480, N'Serves 2', 2),
    (@R7, @Str,  N'Garlic Bread Sticks',   N'6 pcs with herb butter and cheese dip.',                                   180, NULL, N'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600&q=75', 1, 0, 4.30, 320, N'Serves 1', 3),
    (@R7, @Des,  N'Tiramisu Jar',          N'Mascarpone, espresso-soaked savoiardi, cocoa.',                            260, NULL, N'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&q=75', 1, 1, 4.70, 410, N'Serves 1', 4),

    /* ---- R8 Biryani Bandi ---- */
    (@R8, @Rice, N'Hyderabadi Chicken Dum Biryani', N'Handi dum biryani with raita and mirchi ka salan.',               340, 299, N'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&q=75', 0, 1, 4.60, 1420, N'Serves 1-2', 1),
    (@R8, @Rice, N'Mutton Dum Biryani',    N'Slow-dum mutton biryani, long grain basmati.',                             460, NULL, N'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&q=75', 0, 1, 4.50, 880, N'Serves 1-2', 2),
    (@R8, @Rice, N'Veg Tahiri Biryani',    N'Aromatic vegetable biryani with fried onion.',                             240, NULL, N'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&q=75', 1, 0, 4.20, 340, N'Serves 1',   3),
    (@R8, @Des,  N'Double Ka Meetha',      N'Fried bread pudding in saffron milk.',                                     140, NULL, N'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=75', 1, 0, 4.40, 220, N'Serves 1',   4),

    /* ---- R9 Cafe Chaupal ---- */
    (@R9, @Rec,  N'Big Breakfast Platter', N'Eggs, sausage, hash brown, baked beans, toast.',                            380, 349, N'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&q=75', 0, 1, 4.30, 410, N'Serves 1', 1),
    (@R9, @Rec,  N'Avocado Toast',         N'Sourdough, smashed avocado, chilli flakes, poached egg.',                   320, NULL, N'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=600&q=75', 0, 0, 4.20, 260, N'Serves 1', 2),
    (@R9, @Bev,  N'Cold Brew Coffee',      N'18-hour slow steeped, served over ice.',                                    220, NULL, N'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&q=75', 1, 1, 4.50, 520, N'Serves 1', 3),
    (@R9, @Des,  N'Belgian Chocolate Brownie', N'Warm brownie with vanilla ice cream.',                                  240, 199, N'https://images.unsplash.com/photo-1607920591413-4ec007e70023?w=600&q=75', 1, 1, 4.60, 480, N'Serves 1', 4),

    /* ---- R10 Marwari Rasoi ---- */
    (@R10, @Rec, N'Rajasthani Unlimited Thali', N'Dal baati churma, gatte, ker sangri, bajra roti, unlimited.',          420, 379, N'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&q=75', 1, 1, 4.50, 620, N'Serves 1', 1),
    (@R10, @Main, N'Dal Baati Churma',     N'3 baati, panchmel dal, churma with ghee.',                                  280, NULL, N'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&q=75', 1, 1, 4.60, 540, N'Serves 1', 2),
    (@R10, @Main, N'Gatte Ki Sabzi',       N'Gram flour dumplings in tangy yoghurt curry.',                              240, NULL, N'https://images.unsplash.com/photo-1626500155537-5e5b0ba8ad5a?w=600&q=75', 1, 0, 4.30, 280, N'Serves 2', 3),

    /* ---- R11 Burger Garage ---- */
    (@R11, @Burg, N'Double Smash Cheeseburger', N'Two smashed patties, American cheese, house sauce.',                   340, 299, N'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=75', 0, 1, 4.40, 980, N'Serves 1', 1),
    (@R11, @Burg, N'Crispy Paneer Burger', N'Panko paneer, slaw, mint mayo.',                                            260, NULL, N'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&q=75', 1, 1, 4.30, 620, N'Serves 1', 2),
    (@R11, @Str,  N'Loaded Peri Fries',    N'Fries with cheese sauce, peri peri and jalapenos.',                         220, NULL, N'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=75', 1, 0, 4.20, 480, N'Serves 1', 3),
    (@R11, @Bev,  N'Oreo Thick Shake',     N'Vanilla ice cream, oreo crumble, whipped cream.',                           240, NULL, N'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&q=75', 1, 1, 4.50, 560, N'Serves 1', 4),

    /* ---- R12 Royal Darbar ---- */
    (@R12, @Rec,  N'Shahi Paneer Handi',   N'Cashew-cream gravy with kesar and paneer.',                                 460, NULL, N'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&q=75', 1, 1, 4.50, 280, N'Serves 2', 1),
    (@R12, @Rec,  N'Murgh Malai Kebab',    N'Cream-cheese chicken kebab, melt-in-mouth.',                                520, 469, N'https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?w=600&q=75', 0, 1, 4.60, 320, N'Serves 2', 2),
    (@R12, @Main, N'Veg Kofta Curry',      N'Mixed veg koftas in rich tomato-onion gravy.',                              380, NULL, N'https://images.unsplash.com/photo-1626500155537-5e5b0ba8ad5a?w=600&q=75', 1, 0, 4.20, 180, N'Serves 2', 3),
    (@R12, @Des,  N'Rasmalai (2 pcs)',     N'Soft chenna patties in saffron milk.',                                      180, NULL, N'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=600&q=75', 1, 0, 4.50, 210, N'Serves 1', 4);
END
GO

/* ==================== RESTAURANT TABLES ======================= */
IF NOT EXISTS (SELECT 1 FROM dbo.RestaurantTables)
BEGIN
    /* har table-booking wale restaurant me: 4x2-seater, 5x4-seater, 3x6-seater
       (2 outdoor agar outdoor seating hai) */
    INSERT INTO dbo.RestaurantTables (RestaurantId, TableNumber, SeatCapacity, Location)
    SELECT r.RestaurantId,
           N'T' + RIGHT(N'0' + CAST(n.Num AS NVARCHAR(3)), 2),
           CASE WHEN n.Num <= 4 THEN 2 WHEN n.Num <= 9 THEN 4 ELSE 6 END,
           CASE WHEN r.HasOutdoorSeating = 1 AND n.Num IN (11, 12) THEN N'Outdoor' ELSE N'Indoor' END
    FROM   dbo.Restaurants r
    CROSS JOIN (SELECT TOP 12 ROW_NUMBER() OVER (ORDER BY object_id) AS Num
                FROM sys.all_objects) n
    WHERE  r.HasTableBooking = 1;
END
GO

/* ============================ HALLS =========================== */
IF NOT EXISTS (SELECT 1 FROM dbo.Halls)
BEGIN
    INSERT INTO dbo.Halls
      (RestaurantId, Name, Description, MinCapacity, MaxCapacity, PricePerPlate, BaseRent,
       ImageUrl, AmenitiesJson, HasAC, HasParking, HasDJ)
    SELECT RestaurantId, N'Emerald Hall',
           N'Intimate indoor hall - birthday aur small family functions ke liye best. Basic decor included.',
           20, 60, 850, 8000,
           N'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&q=75',
           N'["AC","Music System","Parking","Birthday Decor","Cake Table"]', 1, 1, 0
    FROM   dbo.Restaurants WHERE HasHallBooking = 1

    UNION ALL
    SELECT RestaurantId, N'Grand Ballroom',
           N'Bada banquet hall - wedding, reception aur corporate events. DJ aur stage included.',
           60, 250, 1200, 25000,
           N'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=75',
           N'["AC","DJ","Stage","Valet Parking","LED Wall","Bridal Room"]', 1, 1, 1
    FROM   dbo.Restaurants WHERE HasHallBooking = 1

    UNION ALL
    SELECT RestaurantId, N'Terrace Garden',
           N'Open-air rooftop - cocktail parties aur birthday bashes ke liye. Fairy-light decor.',
           30, 120, 1000, 15000,
           N'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&q=75',
           N'["Open Air","DJ","Bar Counter","Parking","Fairy Lights"]', 0, 1, 1
    FROM   dbo.Restaurants WHERE HasHallBooking = 1 AND HasOutdoorSeating = 1;
END
GO

/* ================== EMPLOYEE -> RESTAURANT ==================== */
IF NOT EXISTS (SELECT 1 FROM dbo.RestaurantEmployees)
BEGIN
    DECLARE @Admin INT = (SELECT UserId FROM dbo.Users WHERE Email = N'admin@foodmitra.in');

    INSERT INTO dbo.RestaurantEmployees
      (UserId, RestaurantId, Designation, CanManageMenu, CanManageOrder, CanManageBooking, AssignedByUserId)
    SELECT u.UserId, r.RestaurantId, x.Designation, x.Menu, x.Ord, x.Book, @Admin
    FROM (VALUES
        (N'rahul.emp@foodmitra.in',  N'kwality-spice-house-connaught-place',      N'Manager',      1, 1, 1),
        (N'rahul.emp@foodmitra.in',  N'tandoori-tales-saket',                    N'Manager',      1, 1, 1),
        (N'sneha.emp@foodmitra.in',  N'6-bay-leaf-bengali-kitchen-malviya-nagar', N'Manager',      1, 1, 1),
        (N'sneha.emp@foodmitra.in',  N'dakshin-tiffin-room-hauz-khas',           N'Menu Manager', 1, 1, 0),
        (N'imran.emp@foodmitra.in',  N'open-tap-brewhouse-golf-course-road',     N'Manager',      1, 1, 1),
        (N'imran.emp@foodmitra.in',  N'wok-republic-cyber-hub',                  N'Supervisor',   0, 1, 1),
        (N'deepak.emp@foodmitra.in', N'biryani-bandi-karol-bagh',                N'DeliveryBoy',  0, 1, 0),
        (N'deepak.emp@foodmitra.in', N'kwality-spice-house-connaught-place',     N'DeliveryBoy',  0, 1, 0),
        (N'priya.emp@foodmitra.in',  N'royal-darbar-banquet-indirapuram',        N'Banquet Manager', 1, 1, 1),
        (N'priya.emp@foodmitra.in',  N'napoli-craft-pizzeria-sector-18-noida',   N'Supervisor',   1, 1, 0),
        (N'arjun.emp@foodmitra.in',  N'burger-garage-rajouri-garden',            N'Manager',      1, 1, 0),
        (N'arjun.emp@foodmitra.in',  N'cafe-chaupal-lajpat-nagar',               N'Manager',      1, 1, 1)
    ) AS x(Email, Slug, Designation, Menu, Ord, Book)
    JOIN dbo.Users u       ON u.Email = x.Email
    JOIN dbo.Restaurants r ON r.Slug  = x.Slug;
END
GO

/* ========================= USER ADDRESSES ===================== */
IF NOT EXISTS (SELECT 1 FROM dbo.UserAddresses)
BEGIN
    INSERT INTO dbo.UserAddresses (UserId, Label, AddressLine, Landmark, City, Pincode, Latitude, Longitude, IsDefault)
    SELECT u.UserId, x.Label, x.Line, x.Landmark, x.City, x.Pin, x.Lat, x.Lng, x.Def
    FROM (VALUES
        (N'ananya@example.com', N'Home', N'Flat 402, Sunrise Apartments, Sector 15',    N'Near Metro Station',  N'New Delhi', N'110001', 28.6280, 77.2200, CAST(1 AS BIT)),
        (N'ananya@example.com', N'Work', N'WeWork, Barakhamba Road',                    N'Opp. Metro Gate 4',   N'New Delhi', N'110001', 28.6300, 77.2250, CAST(0 AS BIT)),
        (N'vikram@example.com', N'Home', N'H-24, Green Park Extension',                 N'Behind Market',       N'New Delhi', N'110016', 28.5600, 77.2050, CAST(1 AS BIT)),
        (N'meera@example.com',  N'Home', N'Tower 7, Ireo Uptown, Sector 66',            N'Golf Course Ext Rd',  N'Gurgaon',   N'122002', 28.4200, 77.0600, CAST(1 AS BIT)),
        (N'rohit@example.com',  N'Home', N'B-101, Amrapali Zodiac, Sector 120',         N'Near City Centre',    N'Noida',     N'201301', 28.5900, 77.3700, CAST(1 AS BIT)),
        (N'fatima@example.com', N'Home', N'D-56, Zakir Nagar',                          N'Near Jamia',          N'New Delhi', N'110025', 28.5620, 77.2800, CAST(1 AS BIT)),
        (N'sanjay@example.com', N'Home', N'56, Shakti Khand 3, Indirapuram',            N'Near Shipra Mall',    N'Ghaziabad', N'201014', 28.6400, 77.3680, CAST(1 AS BIT))
    ) AS x(Email, Label, Line, Landmark, City, Pin, Lat, Lng, Def)
    JOIN dbo.Users u ON u.Email = x.Email;
END
GO

/* ============================ COUPONS ========================= */
IF NOT EXISTS (SELECT 1 FROM dbo.Coupons)
BEGIN
    DECLARE @From DATETIME2(0) = DATEADD(DAY, -10, SYSUTCDATETIME());
    DECLARE @To   DATETIME2(0) = DATEADD(DAY,  90, SYSUTCDATETIME());

    INSERT INTO dbo.Coupons
      (Code, Title, Description, DiscountType, DiscountValue, MaxDiscountAmount,
       MinOrderAmount, RestaurantId, AppliesTo, ValidFrom, ValidTo, UsageLimit, UsageLimitPerUser)
    VALUES
      (N'WELCOME50',  N'50% OFF up to Rs 150', N'Pehle order par 50% off. Sabhi restaurants par valid.',
       N'PERCENT', 50, 150, 200, NULL, 'ORDER', @From, @To, 5000, 1),

      (N'FLAT100',    N'Flat Rs 100 OFF',      N'Rs 499 se upar ke order par flat Rs 100 ki bachat.',
       N'FLAT', 100, NULL, 499, NULL, 'ORDER', @From, @To, NULL, 5),

      (N'BIRYANI20',  N'20% OFF on Biryani',   N'Biryani Bandi par 20% off, max Rs 120.',
       N'PERCENT', 20, 120, 299, (SELECT RestaurantId FROM dbo.Restaurants WHERE Slug = N'biryani-bandi-karol-bagh'),
       'ORDER', @From, @To, NULL, 3),

      (N'PIZZAFEST',  N'Rs 150 OFF on Pizza',  N'Napoli Craft Pizzeria par Rs 699+ order par Rs 150 off.',
       N'FLAT', 150, NULL, 699, (SELECT RestaurantId FROM dbo.Restaurants WHERE Slug = N'napoli-craft-pizzeria-sector-18-noida'),
       'ORDER', @From, @To, NULL, 3),

      (N'PARTY15',    N'15% OFF on Hall Booking', N'Birthday aur party hall booking par 15% off, max Rs 5000.',
       N'PERCENT', 15, 5000, 15000, NULL, 'HALL', @From, @To, NULL, 2),

      (N'BDAYSPECIAL', N'Rs 2500 OFF Birthday Package', N'Birthday hall booking par flat Rs 2500 off (min Rs 25000).',
       N'FLAT', 2500, NULL, 25000, NULL, 'HALL', @From, @To, 500, 1),

      (N'TABLE10',    N'10% OFF Dine-in',      N'Table booking ke saath dine-in par 10% off.',
       N'PERCENT', 10, 500, 0, NULL, 'TABLE', @From, @To, NULL, 4),

      (N'WEEKEND30',  N'30% OFF Weekend',      N'Weekend special - 30% off up to Rs 200.',
       N'PERCENT', 30, 200, 399, NULL, 'ORDER', @From, @To, 2000, 2);
END
GO

/* ========================= TESTIMONIALS ======================= */
IF NOT EXISTS (SELECT 1 FROM dbo.Testimonials)
INSERT INTO dbo.Testimonials (CustomerName, CustomerImage, City, Designation, Rating, Message, DisplayOrder) VALUES
 (N'Ananya Sharma', N'https://i.pravatar.cc/150?img=47', N'New Delhi',  N'Software Engineer', 5.00,
  N'Order 28 minute me pahunch gaya, khana bilkul garam tha. Live tracking ka feature bahut accha hai!', 1),
 (N'Vikram Singh',  N'https://i.pravatar.cc/150?img=12', N'New Delhi',  N'Business Owner',    5.00,
  N'Beti ka birthday Royal Darbar ke hall me kiya. Booking se decoration tak sab smooth raha.', 2),
 (N'Meera Iyer',    N'https://i.pravatar.cc/150?img=45', N'Gurgaon',    N'Marketing Manager', 4.50,
  N'Filter coffee aur dosa ke liye Dakshin Tiffin best hai. Coupon se 50% bach gaya pehle order par.', 3),
 (N'Rohit Bansal',  N'https://i.pravatar.cc/150?img=33', N'Noida',      N'CA',                5.00,
  N'Table booking ka option kamaal ka hai - weekend par wait nahi karna padta.', 4),
 (N'Fatima Khan',   N'https://i.pravatar.cc/150?img=44', N'New Delhi',  N'Teacher',           4.50,
  N'Biryani Bandi ki dum biryani authentic hai. Packaging bhi leak-proof thi.', 5),
 (N'Sanjay Gupta',  N'https://i.pravatar.cc/150?img=52', N'Ghaziabad',  N'Shop Owner',        5.00,
  N'15 km tak delivery mil jaati hai, isliye office aur ghar dono se order kar leta hoon.', 6),
 (N'Priyanka Rao',  N'https://i.pravatar.cc/150?img=49', N'Gurgaon',    N'HR Lead',           4.50,
  N'Office party ke liye Terrace Garden book kiya - 80 log, koi dikkat nahi hui.', 7),
 (N'Amit Chauhan',  N'https://i.pravatar.cc/150?img=15', N'New Delhi',  N'Student',           4.00,
  N'Burger Garage ka double smash burger + thick shake combo paise ki poori value hai.', 8);
GO

/* ============================ REVIEWS ========================= */
IF NOT EXISTS (SELECT 1 FROM dbo.Reviews)
BEGIN
    INSERT INTO dbo.Reviews (RestaurantId, UserId, Rating, FoodRating, ServiceRating, Title, Comment, LikeCount)
    SELECT r.RestaurantId, u.UserId, x.Rating, x.Food, x.Service, x.Title, x.Comment, x.Likes
    FROM (VALUES
     (N'kwality-spice-house-connaught-place', N'ananya@example.com', 5.0, 5.0, 4.5, N'Butter chicken is unmatched',
      N'CP me itna accha butter chicken kahin nahi mila. Naan fresh tha aur portion size bada.', 42),
     (N'kwality-spice-house-connaught-place', N'vikram@example.com', 4.5, 4.5, 4.0, N'Great for family dinner',
      N'Dal makhani aur tandoori chicken order kiya. Service thodi slow thi par khana top class.', 18),
     (N'6-bay-leaf-bengali-kitchen-malviya-nagar', N'meera@example.com', 5.0, 5.0, 5.0, N'Kolkata jaisa taste',
      N'Kosha mangsho aur mishti doi - poora Bengal plate me. Owner khud table par aake pooche.', 31),
     (N'open-tap-brewhouse-golf-course-road', N'rohit@example.com', 4.5, 4.0, 4.5, N'Best rooftop in Gurgaon',
      N'Craft beer fresh thi, wings perfectly spicy. Live music Friday ko must-try.', 56),
     (N'dakshin-tiffin-room-hauz-khas', N'fatima@example.com', 4.5, 5.0, 4.0, N'Authentic and cheap',
      N'Ghee roast dosa crisp tha, filter coffee original. Breakfast ke liye best value.', 27),
     (N'biryani-bandi-karol-bagh', N'sanjay@example.com', 4.5, 5.0, 4.0, N'Dum biryani done right',
      N'Rice separate, mutton soft, salan spicy. Delivery bhi 30 min me ho gayi.', 63),
     (N'napoli-craft-pizzeria-sector-18-noida', N'ananya@example.com', 4.5, 4.5, 4.5, N'Real Neapolitan crust',
      N'Margherita ka crust leopard-spotted tha, exactly jaisa hona chahiye. Tiramisu bhi lena.', 22),
     (N'burger-garage-rajouri-garden', N'rohit@example.com', 4.0, 4.5, 3.5, N'Great burger, slow service',
      N'Double smash bahut juicy tha par 25 min wait karna pada. Late night open hona plus point.', 14),
     (N'tandoori-tales-saket', N'meera@example.com', 4.5, 4.5, 4.5, N'Mixed grill worth it',
      N'4 log ke liye ek platter kaafi tha. Malai tikka ekdum soft.', 19),
     (N'royal-darbar-banquet-indirapuram', N'vikram@example.com', 5.0, 5.0, 5.0, N'Perfect birthday venue',
      N'Emerald Hall me 45 guests ka birthday kiya. Decoration, cake table, sab arrange tha.', 38),
     (N'wok-republic-cyber-hub', N'fatima@example.com', 4.0, 4.0, 4.0, N'Quick office lunch',
      N'Hakka noodles aur dim sum accha tha. Peak lunch hour me seating milna mushkil.', 11),
     (N'cafe-chaupal-lajpat-nagar', N'ananya@example.com', 4.0, 4.0, 4.5, N'Laptop-friendly cafe',
      N'Cold brew strong thi, WiFi fast. 3 ghante kaam kiya, koi nahi tokta.', 25),
     (N'marwari-rasoi-dwarka', N'sanjay@example.com', 4.5, 5.0, 4.0, N'Unlimited thali, ghar jaisa',
      N'Dal baati churma authentic. Ghee kanjoosi nahi karte, yahi accha laga.', 29)
    ) AS x(Slug, Email, Rating, Food, Service, Title, Comment, Likes)
    JOIN dbo.Restaurants r ON r.Slug = x.Slug
    JOIN dbo.Users u       ON u.Email = x.Email;

    /* restaurant rating aur count recalculate */
    UPDATE r
    SET    r.Rating = ISNULL(agg.AvgRating, r.Rating),
           r.TotalReviews = r.TotalReviews + ISNULL(agg.Cnt, 0)
    FROM   dbo.Restaurants r
    OUTER APPLY (SELECT CAST(AVG(rv.Rating) AS DECIMAL(3,2)) AS AvgRating, COUNT(*) AS Cnt
                 FROM   dbo.Reviews rv
                 WHERE  rv.RestaurantId = r.RestaurantId AND rv.IsApproved = 1) agg
    WHERE  agg.Cnt > 0;
END
GO

/* ========================= APP SETTINGS ======================= */
IF NOT EXISTS (SELECT 1 FROM dbo.AppSettings)
INSERT INTO dbo.AppSettings (SettingKey, SettingValue, Description) VALUES
 (N'SiteName',            N'FoodMitra',                  N'Website ka naam'),
 (N'SupportPhone',        N'+919810000000',              N'Customer care number'),
 (N'WhatsAppNumber',      N'919810000000',               N'WhatsApp floating button ka number (country code ke saath, + ke bina)'),
 (N'WhatsAppMessage',     N'Hi FoodMitra! Mujhe order me help chahiye.', N'WhatsApp par pre-filled message'),
 (N'MaxDeliveryRadiusKm', N'15',                         N'Global delivery radius limit (km)'),
 (N'GstPercentFood',      N'5',                          N'Food order par GST %'),
 (N'GstPercentHall',      N'18',                         N'Hall booking par GST %'),
 (N'HallAdvancePercent',  N'30',                         N'Hall booking me advance %'),
 (N'PackagingFeeSmall',   N'15',                         N'Rs 300 se kam order par packaging fee'),
 (N'PackagingFeeLarge',   N'25',                         N'Rs 300+ order par packaging fee'),
 (N'CurrencySymbol',      N'Rs',                         N'Currency symbol'),
 (N'DefaultCity',         N'New Delhi',                  N'Default city');
GO

PRINT '=====================================================';
PRINT ' Seed data inserted.';
PRINT ' Login (password: Pass@123)';
PRINT '   Admin    : admin@foodmitra.in';
PRINT '   Employee : rahul.emp@foodmitra.in';
PRINT '   Customer : ananya@example.com';
PRINT '=====================================================';
GO
