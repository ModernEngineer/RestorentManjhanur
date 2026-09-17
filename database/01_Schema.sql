/* ============================================================
   ZomatoClone - Database Schema
   SQL Server 2019+ (2022 / 2025 dono par tested)
   Run order (run_database.ps1 yahi order chalati hai):
     01_Schema.sql -> 02_Functions.sql -> 03_SP_Auth.sql ->
     04_SP_Restaurants.sql -> 05_SP_Menu.sql -> 06_SP_Orders.sql ->
     07_SP_Bookings.sql -> 08_SP_Admin.sql -> 09_SeedData.sql
   ============================================================ */

IF DB_ID('ZomatoCloneDb') IS NULL
    CREATE DATABASE ZomatoCloneDb;
GO

USE ZomatoCloneDb;
GO

/* XML/STRING_AGG aur indexed views ke liye ye settings ON chahiye.
   sqlcmd default me QUOTED_IDENTIFIER OFF rakhta hai, isliye explicit. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ---------- Step 1: saari procedures + functions drop ----------
   Ye pehle zaroori hai, warna TVP types aur tables drop nahi honge
   (SPs unhe reference karti hain -> Msg 3732 / 3729).
   ---------------------------------------------------------------- */
DECLARE @drop NVARCHAR(MAX) = N'';

SELECT @drop = @drop + N'DROP PROCEDURE ' + QUOTENAME(SCHEMA_NAME(p.schema_id))
                     + N'.' + QUOTENAME(p.name) + N';' + CHAR(13) + CHAR(10)
FROM   sys.procedures p;

SELECT @drop = @drop + N'DROP FUNCTION ' + QUOTENAME(SCHEMA_NAME(o.schema_id))
                     + N'.' + QUOTENAME(o.name) + N';' + CHAR(13) + CHAR(10)
FROM   sys.objects o
WHERE  o.type IN ('FN', 'IF', 'TF');

IF LEN(@drop) > 0 EXEC sp_executesql @drop;
GO

/* ---------- Step 2: tables drop in dependency order (safe re-run) ---------- */
IF OBJECT_ID('dbo.Payments','U')            IS NOT NULL DROP TABLE dbo.Payments;
IF OBJECT_ID('dbo.HallBookings','U')        IS NOT NULL DROP TABLE dbo.HallBookings;
IF OBJECT_ID('dbo.Halls','U')               IS NOT NULL DROP TABLE dbo.Halls;
IF OBJECT_ID('dbo.TableBookings','U')       IS NOT NULL DROP TABLE dbo.TableBookings;
IF OBJECT_ID('dbo.RestaurantTables','U')    IS NOT NULL DROP TABLE dbo.RestaurantTables;
IF OBJECT_ID('dbo.Reviews','U')             IS NOT NULL DROP TABLE dbo.Reviews;
IF OBJECT_ID('dbo.OrderStatusHistory','U')  IS NOT NULL DROP TABLE dbo.OrderStatusHistory;
IF OBJECT_ID('dbo.OrderItems','U')          IS NOT NULL DROP TABLE dbo.OrderItems;
IF OBJECT_ID('dbo.CouponUsages','U')        IS NOT NULL DROP TABLE dbo.CouponUsages;
IF OBJECT_ID('dbo.Orders','U')              IS NOT NULL DROP TABLE dbo.Orders;
IF OBJECT_ID('dbo.Coupons','U')             IS NOT NULL DROP TABLE dbo.Coupons;
IF OBJECT_ID('dbo.FoodItems','U')           IS NOT NULL DROP TABLE dbo.FoodItems;
IF OBJECT_ID('dbo.FoodCategories','U')      IS NOT NULL DROP TABLE dbo.FoodCategories;
IF OBJECT_ID('dbo.RestaurantEmployees','U') IS NOT NULL DROP TABLE dbo.RestaurantEmployees;
IF OBJECT_ID('dbo.RestaurantCuisines','U')  IS NOT NULL DROP TABLE dbo.RestaurantCuisines;
IF OBJECT_ID('dbo.Cuisines','U')            IS NOT NULL DROP TABLE dbo.Cuisines;
IF OBJECT_ID('dbo.Restaurants','U')         IS NOT NULL DROP TABLE dbo.Restaurants;
IF OBJECT_ID('dbo.Testimonials','U')        IS NOT NULL DROP TABLE dbo.Testimonials;
IF OBJECT_ID('dbo.UserAddresses','U')       IS NOT NULL DROP TABLE dbo.UserAddresses;
IF OBJECT_ID('dbo.RefreshTokens','U')       IS NOT NULL DROP TABLE dbo.RefreshTokens;
IF OBJECT_ID('dbo.Users','U')               IS NOT NULL DROP TABLE dbo.Users;
IF OBJECT_ID('dbo.Roles','U')               IS NOT NULL DROP TABLE dbo.Roles;
IF OBJECT_ID('dbo.AppSettings','U')         IS NOT NULL DROP TABLE dbo.AppSettings;
GO

/* ============================ ROLES ============================ */
CREATE TABLE dbo.Roles
(
    RoleId      INT IDENTITY(1,1) PRIMARY KEY,
    RoleName    NVARCHAR(50)  NOT NULL UNIQUE,   -- Admin | Employee | Customer
    Description NVARCHAR(200) NULL
);
GO

/* ============================ USERS ============================ */
CREATE TABLE dbo.Users
(
    UserId        INT IDENTITY(1,1) PRIMARY KEY,
    FullName      NVARCHAR(120)  NOT NULL,
    Email         NVARCHAR(160)  NOT NULL,
    Phone         NVARCHAR(20)   NULL,
    PasswordHash  NVARCHAR(400)  NOT NULL,
    RoleId        INT            NOT NULL,
    ProfileImage  NVARCHAR(500)  NULL,
    IsActive      BIT            NOT NULL CONSTRAINT DF_Users_IsActive  DEFAULT(1),
    CreatedAt     DATETIME2(0)   NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT(SYSUTCDATETIME()),
    UpdatedAt     DATETIME2(0)   NULL,
    CONSTRAINT UQ_Users_Email UNIQUE (Email),
    CONSTRAINT FK_Users_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId)
);
GO
CREATE INDEX IX_Users_RoleId ON dbo.Users(RoleId) INCLUDE (FullName, Email, IsActive);
GO

/* ======================= REFRESH TOKENS ======================== */
CREATE TABLE dbo.RefreshTokens
(
    TokenId    BIGINT IDENTITY(1,1) PRIMARY KEY,
    UserId     INT           NOT NULL,
    Token      NVARCHAR(200) NOT NULL,
    ExpiresAt  DATETIME2(0)  NOT NULL,
    IsRevoked  BIT           NOT NULL CONSTRAINT DF_RT_IsRevoked DEFAULT(0),
    CreatedAt  DATETIME2(0)  NOT NULL CONSTRAINT DF_RT_CreatedAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_RT_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId)
);
GO
CREATE UNIQUE INDEX UX_RefreshTokens_Token ON dbo.RefreshTokens(Token);
GO

/* ====================== USER ADDRESSES ========================= */
CREATE TABLE dbo.UserAddresses
(
    AddressId   INT IDENTITY(1,1) PRIMARY KEY,
    UserId      INT            NOT NULL,
    Label       NVARCHAR(40)   NOT NULL CONSTRAINT DF_UA_Label     DEFAULT(N'Home'),
    AddressLine NVARCHAR(300)  NOT NULL,
    Landmark    NVARCHAR(160)  NULL,
    City        NVARCHAR(80)   NOT NULL,
    Pincode     NVARCHAR(10)   NULL,
    Latitude    DECIMAL(9,6)   NOT NULL,
    Longitude   DECIMAL(9,6)   NOT NULL,
    IsDefault   BIT            NOT NULL CONSTRAINT DF_UA_IsDefault DEFAULT(0),
    IsActive    BIT            NOT NULL CONSTRAINT DF_UA_IsActive  DEFAULT(1),
    CreatedAt   DATETIME2(0)   NOT NULL CONSTRAINT DF_UA_CreatedAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_UA_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId)
);
GO
CREATE INDEX IX_UserAddresses_UserId ON dbo.UserAddresses(UserId);
GO

/* ========================= RESTAURANTS ========================= */
CREATE TABLE dbo.Restaurants
(
    RestaurantId       INT IDENTITY(1,1) PRIMARY KEY,
    Name               NVARCHAR(150)  NOT NULL,
    Slug               NVARCHAR(180)  NOT NULL,
    Tagline            NVARCHAR(250)  NULL,
    Description        NVARCHAR(MAX)  NULL,
    ThumbnailUrl       NVARCHAR(500)  NULL,
    CoverImageUrl      NVARCHAR(500)  NULL,
    AddressLine        NVARCHAR(300)  NOT NULL,
    Locality           NVARCHAR(120)  NOT NULL,
    City               NVARCHAR(80)   NOT NULL,
    Pincode            NVARCHAR(10)   NULL,
    Latitude           DECIMAL(9,6)   NOT NULL,
    Longitude          DECIMAL(9,6)   NOT NULL,
    Phone              NVARCHAR(20)   NULL,
    CostForTwo         DECIMAL(10,2)  NOT NULL CONSTRAINT DF_Rest_CostForTwo DEFAULT(500),
    Rating             DECIMAL(3,2)   NOT NULL CONSTRAINT DF_Rest_Rating     DEFAULT(0),
    TotalReviews       INT            NOT NULL CONSTRAINT DF_Rest_TotalRev   DEFAULT(0),
    OpeningTime        TIME(0)        NOT NULL CONSTRAINT DF_Rest_Open       DEFAULT('11:00'),
    ClosingTime        TIME(0)        NOT NULL CONSTRAINT DF_Rest_Close      DEFAULT('23:00'),
    DeliveryRadiusKm   DECIMAL(5,2)   NOT NULL CONSTRAINT DF_Rest_Radius     DEFAULT(15.00),
    AvgPrepTimeMin     INT            NOT NULL CONSTRAINT DF_Rest_Prep       DEFAULT(30),
    IsPureVeg          BIT            NOT NULL CONSTRAINT DF_Rest_Veg        DEFAULT(0),
    HasOutdoorSeating  BIT            NOT NULL CONSTRAINT DF_Rest_Outdoor    DEFAULT(0),
    IsPetFriendly      BIT            NOT NULL CONSTRAINT DF_Rest_Pet        DEFAULT(0),
    ServesAlcohol      BIT            NOT NULL CONSTRAINT DF_Rest_Alcohol    DEFAULT(0),
    HasTableBooking    BIT            NOT NULL CONSTRAINT DF_Rest_TableBk    DEFAULT(1),
    HasHallBooking     BIT            NOT NULL CONSTRAINT DF_Rest_HallBk     DEFAULT(0),
    AcceptsOnlineOrder BIT            NOT NULL CONSTRAINT DF_Rest_Online     DEFAULT(1),
    IsPromoted         BIT            NOT NULL CONSTRAINT DF_Rest_Promoted   DEFAULT(0),
    IsActive           BIT            NOT NULL CONSTRAINT DF_Rest_IsActive   DEFAULT(1),
    CreatedAt          DATETIME2(0)   NOT NULL CONSTRAINT DF_Rest_CreatedAt  DEFAULT(SYSUTCDATETIME()),
    UpdatedAt          DATETIME2(0)   NULL,
    CONSTRAINT UQ_Restaurants_Slug   UNIQUE (Slug),
    CONSTRAINT CK_Restaurants_Rating CHECK (Rating BETWEEN 0 AND 5)
);
GO
CREATE INDEX IX_Restaurants_City_Active ON dbo.Restaurants(City, IsActive) INCLUDE (Name, Rating, CostForTwo);
CREATE INDEX IX_Restaurants_Rating      ON dbo.Restaurants(Rating DESC);
GO

/* =========================== CUISINES ========================== */
CREATE TABLE dbo.Cuisines
(
    CuisineId INT IDENTITY(1,1) PRIMARY KEY,
    Name      NVARCHAR(80)  NOT NULL UNIQUE,
    IconUrl   NVARCHAR(500) NULL,
    IsActive  BIT           NOT NULL CONSTRAINT DF_Cuisine_IsActive DEFAULT(1)
);
GO

CREATE TABLE dbo.RestaurantCuisines
(
    RestaurantId INT NOT NULL,
    CuisineId    INT NOT NULL,
    CONSTRAINT PK_RestaurantCuisines PRIMARY KEY (RestaurantId, CuisineId),
    CONSTRAINT FK_RC_Restaurants FOREIGN KEY (RestaurantId) REFERENCES dbo.Restaurants(RestaurantId) ON DELETE CASCADE,
    CONSTRAINT FK_RC_Cuisines    FOREIGN KEY (CuisineId)    REFERENCES dbo.Cuisines(CuisineId)       ON DELETE CASCADE
);
GO

/* ============= RESTAURANT <-> EMPLOYEE ASSIGNMENT ==============
   Kis employee ko kaunsa restaurant diya gaya hai - ye table wahi
   mapping rakhti hai, per-restaurant permissions ke saath.
   ============================================================== */
CREATE TABLE dbo.RestaurantEmployees
(
    AssignmentId     INT IDENTITY(1,1) PRIMARY KEY,
    UserId           INT           NOT NULL,
    RestaurantId     INT           NOT NULL,
    Designation      NVARCHAR(80)  NOT NULL CONSTRAINT DF_RE_Desig DEFAULT(N'Manager'),
    CanManageMenu    BIT           NOT NULL CONSTRAINT DF_RE_Menu  DEFAULT(0),
    CanManageOrder   BIT           NOT NULL CONSTRAINT DF_RE_Order DEFAULT(1),
    CanManageBooking BIT           NOT NULL CONSTRAINT DF_RE_Book  DEFAULT(0),
    AssignedByUserId INT           NULL,
    AssignedAt       DATETIME2(0)  NOT NULL CONSTRAINT DF_RE_AssignedAt DEFAULT(SYSUTCDATETIME()),
    IsActive         BIT           NOT NULL CONSTRAINT DF_RE_IsActive   DEFAULT(1),
    CONSTRAINT FK_RE_Users       FOREIGN KEY (UserId)       REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_RE_Restaurants FOREIGN KEY (RestaurantId) REFERENCES dbo.Restaurants(RestaurantId),
    CONSTRAINT UQ_RE_User_Rest   UNIQUE (UserId, RestaurantId)
);
GO
CREATE INDEX IX_RE_RestaurantId ON dbo.RestaurantEmployees(RestaurantId, IsActive);
GO

/* ======================= FOOD CATEGORIES ======================= */
CREATE TABLE dbo.FoodCategories
(
    CategoryId   INT IDENTITY(1,1) PRIMARY KEY,
    RestaurantId INT           NULL,          -- NULL = global category
    Name         NVARCHAR(100) NOT NULL,
    DisplayOrder INT           NOT NULL CONSTRAINT DF_FC_Order    DEFAULT(0),
    IsActive     BIT           NOT NULL CONSTRAINT DF_FC_IsActive DEFAULT(1),
    CONSTRAINT FK_FC_Restaurants FOREIGN KEY (RestaurantId) REFERENCES dbo.Restaurants(RestaurantId)
);
GO

/* ========================== FOOD ITEMS ========================= */
CREATE TABLE dbo.FoodItems
(
    FoodItemId    INT IDENTITY(1,1) PRIMARY KEY,
    RestaurantId  INT            NOT NULL,
    CategoryId    INT            NULL,
    Name          NVARCHAR(150)  NOT NULL,
    Description   NVARCHAR(600)  NULL,
    Price         DECIMAL(10,2)  NOT NULL,
    DiscountPrice DECIMAL(10,2)  NULL,
    ImageUrl      NVARCHAR(500)  NULL,          -- admin panel se change hota hai
    IsVeg         BIT            NOT NULL CONSTRAINT DF_FI_IsVeg     DEFAULT(1),
    IsBestseller  BIT            NOT NULL CONSTRAINT DF_FI_Best      DEFAULT(0),
    IsAvailable   BIT            NOT NULL CONSTRAINT DF_FI_Available DEFAULT(1),
    Rating        DECIMAL(3,2)   NOT NULL CONSTRAINT DF_FI_Rating    DEFAULT(0),
    TotalReviews  INT            NOT NULL CONSTRAINT DF_FI_TotalRev  DEFAULT(0),
    ServesCount   NVARCHAR(40)   NULL,
    DisplayOrder  INT            NOT NULL CONSTRAINT DF_FI_Order     DEFAULT(0),
    IsActive      BIT            NOT NULL CONSTRAINT DF_FI_IsActive  DEFAULT(1),
    CreatedAt     DATETIME2(0)   NOT NULL CONSTRAINT DF_FI_CreatedAt DEFAULT(SYSUTCDATETIME()),
    UpdatedAt     DATETIME2(0)   NULL,
    CONSTRAINT FK_FI_Restaurants    FOREIGN KEY (RestaurantId) REFERENCES dbo.Restaurants(RestaurantId),
    CONSTRAINT FK_FI_FoodCategories FOREIGN KEY (CategoryId)   REFERENCES dbo.FoodCategories(CategoryId),
    CONSTRAINT CK_FI_Price          CHECK (Price > 0),
    CONSTRAINT CK_FI_DiscountPrice  CHECK (DiscountPrice IS NULL OR DiscountPrice < Price)
);
GO
CREATE INDEX IX_FoodItems_Restaurant ON dbo.FoodItems(RestaurantId, IsActive) INCLUDE (Name, Price, ImageUrl);
GO

/* =================== COUPONS / DISCOUNTS ======================= */
CREATE TABLE dbo.Coupons
(
    CouponId          INT IDENTITY(1,1) PRIMARY KEY,
    Code              NVARCHAR(40)  NOT NULL,
    Title             NVARCHAR(150) NOT NULL,
    Description       NVARCHAR(400) NULL,
    DiscountType      NVARCHAR(10)  NOT NULL,   -- PERCENT | FLAT
    DiscountValue     DECIMAL(10,2) NOT NULL,
    MaxDiscountAmount DECIMAL(10,2) NULL,
    MinOrderAmount    DECIMAL(10,2) NOT NULL CONSTRAINT DF_Cp_MinOrder  DEFAULT(0),
    RestaurantId      INT           NULL,       -- NULL = all restaurants
    AppliesTo         NVARCHAR(20)  NOT NULL CONSTRAINT DF_Cp_AppliesTo DEFAULT('ORDER'),
    ValidFrom         DATETIME2(0)  NOT NULL,
    ValidTo           DATETIME2(0)  NOT NULL,
    UsageLimit        INT           NULL,
    UsageLimitPerUser INT           NULL,
    UsedCount         INT           NOT NULL CONSTRAINT DF_Cp_UsedCount DEFAULT(0),
    IsActive          BIT           NOT NULL CONSTRAINT DF_Cp_IsActive  DEFAULT(1),
    CreatedAt         DATETIME2(0)  NOT NULL CONSTRAINT DF_Cp_CreatedAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT UQ_Coupons_Code   UNIQUE (Code),
    CONSTRAINT FK_Cp_Restaurants FOREIGN KEY (RestaurantId) REFERENCES dbo.Restaurants(RestaurantId),
    CONSTRAINT CK_Cp_Type        CHECK (DiscountType IN ('PERCENT','FLAT')),
    CONSTRAINT CK_Cp_AppliesTo   CHECK (AppliesTo IN ('ORDER','TABLE','HALL'))
);
GO

/* ============================ ORDERS =========================== */
CREATE TABLE dbo.Orders
(
    OrderId            BIGINT IDENTITY(1001,1) PRIMARY KEY,
    OrderNumber        NVARCHAR(30)   NOT NULL,
    UserId             INT            NOT NULL,
    RestaurantId       INT            NOT NULL,
    AddressId          INT            NULL,
    DeliveryAddress    NVARCHAR(400)  NOT NULL,
    DeliveryLatitude   DECIMAL(9,6)   NULL,
    DeliveryLongitude  DECIMAL(9,6)   NULL,
    DistanceKm         DECIMAL(6,2)   NOT NULL CONSTRAINT DF_Ord_Distance DEFAULT(0),
    SubTotal           DECIMAL(12,2)  NOT NULL,
    DiscountAmount     DECIMAL(12,2)  NOT NULL CONSTRAINT DF_Ord_Discount DEFAULT(0),
    DeliveryFee        DECIMAL(12,2)  NOT NULL CONSTRAINT DF_Ord_DelFee   DEFAULT(0),
    PackagingFee       DECIMAL(12,2)  NOT NULL CONSTRAINT DF_Ord_PackFee  DEFAULT(0),
    TaxAmount          DECIMAL(12,2)  NOT NULL CONSTRAINT DF_Ord_Tax      DEFAULT(0),
    TotalAmount        DECIMAL(12,2)  NOT NULL,
    CouponId           INT            NULL,
    CouponCode         NVARCHAR(40)   NULL,
    OrderType          NVARCHAR(20)   NOT NULL CONSTRAINT DF_Ord_Type    DEFAULT('DELIVERY'),
    Status             NVARCHAR(25)   NOT NULL CONSTRAINT DF_Ord_Status  DEFAULT('PLACED'),
    PaymentMode        NVARCHAR(20)   NOT NULL CONSTRAINT DF_Ord_PayMode DEFAULT('ONLINE'),
    PaymentStatus      NVARCHAR(20)   NOT NULL CONSTRAINT DF_Ord_PayStat DEFAULT('PENDING'),
    DeliveryEmployeeId INT            NULL, 
    CustomerNote       NVARCHAR(500)  NULL,
    CancelReason       NVARCHAR(400)  NULL,
    EtaMinutes         INT            NULL,
    PlacedAt           DATETIME2(0)   NOT NULL CONSTRAINT DF_Ord_PlacedAt DEFAULT(SYSUTCDATETIME()),
    DeliveredAt        DATETIME2(0)   NULL,
    UpdatedAt          DATETIME2(0)   NULL,
    CONSTRAINT UQ_Orders_OrderNumber UNIQUE (OrderNumber),
    CONSTRAINT FK_Ord_Users       FOREIGN KEY (UserId)             REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_Ord_Restaurants FOREIGN KEY (RestaurantId)       REFERENCES dbo.Restaurants(RestaurantId),
    CONSTRAINT FK_Ord_Addresses   FOREIGN KEY (AddressId)          REFERENCES dbo.UserAddresses(AddressId),
    CONSTRAINT FK_Ord_Coupons     FOREIGN KEY (CouponId)           REFERENCES dbo.Coupons(CouponId),
    CONSTRAINT FK_Ord_DelEmp      FOREIGN KEY (DeliveryEmployeeId) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_Ord_Status      CHECK (Status IN ('PLACED','CONFIRMED','PREPARING','OUT_FOR_DELIVERY','DELIVERED','CANCELLED','REJECTED')),
    CONSTRAINT CK_Ord_PayStatus   CHECK (PaymentStatus IN ('PENDING','PAID','FAILED','REFUNDED'))
);
GO
CREATE INDEX IX_Orders_User   ON dbo.Orders(UserId, PlacedAt DESC);
CREATE INDEX IX_Orders_Rest   ON dbo.Orders(RestaurantId, Status) INCLUDE (TotalAmount, PlacedAt);
CREATE INDEX IX_Orders_DelEmp ON dbo.Orders(DeliveryEmployeeId, Status);
GO

CREATE TABLE dbo.OrderItems
(
    OrderItemId BIGINT IDENTITY(1,1) PRIMARY KEY,
    OrderId     BIGINT         NOT NULL,
    FoodItemId  INT            NOT NULL,
    ItemName    NVARCHAR(150)  NOT NULL,
    ItemImage   NVARCHAR(500)  NULL,
    UnitPrice   DECIMAL(10,2)  NOT NULL,
    Quantity    INT            NOT NULL,
    LineTotal   DECIMAL(12,2)  NOT NULL,
    Notes       NVARCHAR(300)  NULL,
    CONSTRAINT FK_OI_Orders    FOREIGN KEY (OrderId)    REFERENCES dbo.Orders(OrderId) ON DELETE CASCADE,
    CONSTRAINT FK_OI_FoodItems FOREIGN KEY (FoodItemId) REFERENCES dbo.FoodItems(FoodItemId),
    CONSTRAINT CK_OI_Qty       CHECK (Quantity > 0)
);
GO
CREATE INDEX IX_OrderItems_OrderId ON dbo.OrderItems(OrderId);
GO

CREATE TABLE dbo.OrderStatusHistory
(
    HistoryId       BIGINT IDENTITY(1,1) PRIMARY KEY,
    OrderId         BIGINT        NOT NULL,
    Status          NVARCHAR(25)  NOT NULL,
    Remarks         NVARCHAR(400) NULL,
    ChangedByUserId INT           NULL,
    ChangedAt       DATETIME2(0)  NOT NULL CONSTRAINT DF_OSH_ChangedAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_OSH_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId) ON DELETE CASCADE
);
GO
CREATE INDEX IX_OSH_OrderId ON dbo.OrderStatusHistory(OrderId, ChangedAt);
GO

CREATE TABLE dbo.CouponUsages
(
    UsageId  BIGINT IDENTITY(1,1) PRIMARY KEY,
    CouponId INT           NOT NULL,
    UserId   INT           NOT NULL,
    OrderId  BIGINT        NULL,
    Amount   DECIMAL(10,2) NOT NULL,
    UsedAt   DATETIME2(0)  NOT NULL CONSTRAINT DF_CU_UsedAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_CU_Coupons FOREIGN KEY (CouponId) REFERENCES dbo.Coupons(CouponId),
    CONSTRAINT FK_CU_Users   FOREIGN KEY (UserId)   REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_CU_Orders  FOREIGN KEY (OrderId)  REFERENCES dbo.Orders(OrderId)
);
GO
CREATE INDEX IX_CU_Coupon_User ON dbo.CouponUsages(CouponId, UserId);
GO

/* =========================== REVIEWS =========================== */
CREATE TABLE dbo.Reviews
(
    ReviewId      BIGINT IDENTITY(1,1) PRIMARY KEY,
    RestaurantId  INT            NOT NULL,
    UserId        INT            NOT NULL,
    OrderId       BIGINT         NULL,
    Rating        DECIMAL(3,2)   NOT NULL,
    FoodRating    DECIMAL(3,2)   NULL,
    ServiceRating DECIMAL(3,2)   NULL,
    Title         NVARCHAR(150)  NULL,
    Comment       NVARCHAR(MAX)  NULL,
    ImageUrl      NVARCHAR(500)  NULL,
    LikeCount     INT            NOT NULL CONSTRAINT DF_Rv_Likes     DEFAULT(0),
    IsApproved    BIT            NOT NULL CONSTRAINT DF_Rv_Approved  DEFAULT(1),
    CreatedAt     DATETIME2(0)   NOT NULL CONSTRAINT DF_Rv_CreatedAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_Rv_Restaurants FOREIGN KEY (RestaurantId) REFERENCES dbo.Restaurants(RestaurantId),
    CONSTRAINT FK_Rv_Users       FOREIGN KEY (UserId)       REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_Rv_Orders      FOREIGN KEY (OrderId)      REFERENCES dbo.Orders(OrderId),
    CONSTRAINT CK_Rv_Rating      CHECK (Rating BETWEEN 1 AND 5)
);
GO
CREATE INDEX IX_Reviews_Restaurant ON dbo.Reviews(RestaurantId, IsApproved, CreatedAt DESC);
GO

/* ======================= TABLE BOOKING ========================= */
CREATE TABLE dbo.RestaurantTables
(
    TableId      INT IDENTITY(1,1) PRIMARY KEY,
    RestaurantId INT           NOT NULL,
    TableNumber  NVARCHAR(20)  NOT NULL,
    SeatCapacity INT           NOT NULL CONSTRAINT DF_RTb_Seats  DEFAULT(4),
    Location     NVARCHAR(40)  NOT NULL CONSTRAINT DF_RTb_Loc    DEFAULT(N'Indoor'),
    IsActive     BIT           NOT NULL CONSTRAINT DF_RTb_Active DEFAULT(1),
    CONSTRAINT FK_RTb_Restaurants FOREIGN KEY (RestaurantId) REFERENCES dbo.Restaurants(RestaurantId),
    CONSTRAINT UQ_RTb_Rest_Number UNIQUE (RestaurantId, TableNumber)
);
GO

CREATE TABLE dbo.TableBookings
(
    BookingId       BIGINT IDENTITY(5001,1) PRIMARY KEY,
    BookingNumber   NVARCHAR(30)  NOT NULL,
    RestaurantId    INT           NOT NULL,
    UserId          INT           NOT NULL,
    TableId         INT           NULL,
    GuestName       NVARCHAR(120) NOT NULL,
    GuestPhone      NVARCHAR(20)  NOT NULL,
    BookingDate     DATE          NOT NULL,
    BookingTime     TIME(0)       NOT NULL,
    DurationMin     INT           NOT NULL CONSTRAINT DF_TB_Duration DEFAULT(90),
    GuestCount      INT           NOT NULL,
    SeatingPref     NVARCHAR(40)  NULL,
    Occasion        NVARCHAR(60)  NULL,
    SpecialRequest  NVARCHAR(500) NULL,
    Status          NVARCHAR(20)  NOT NULL CONSTRAINT DF_TB_Status DEFAULT('PENDING'),
    HandledByUserId INT           NULL,
    CreatedAt       DATETIME2(0)  NOT NULL CONSTRAINT DF_TB_CreatedAt DEFAULT(SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(0)  NULL,
    CONSTRAINT UQ_TB_Number      UNIQUE (BookingNumber),
    CONSTRAINT FK_TB_Restaurants FOREIGN KEY (RestaurantId) REFERENCES dbo.Restaurants(RestaurantId),
    CONSTRAINT FK_TB_Users       FOREIGN KEY (UserId)       REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_TB_Tables      FOREIGN KEY (TableId)      REFERENCES dbo.RestaurantTables(TableId),
    CONSTRAINT CK_TB_Guests      CHECK (GuestCount > 0),
    CONSTRAINT CK_TB_Status      CHECK (Status IN ('PENDING','CONFIRMED','SEATED','COMPLETED','CANCELLED','REJECTED'))
);
GO
CREATE INDEX IX_TB_Rest_Date ON dbo.TableBookings(RestaurantId, BookingDate, Status);
CREATE INDEX IX_TB_User      ON dbo.TableBookings(UserId, CreatedAt DESC);
GO

/* ================== HALL / PARTY BOOKING ======================= */
CREATE TABLE dbo.Halls
(
    HallId        INT IDENTITY(1,1) PRIMARY KEY,
    RestaurantId  INT            NOT NULL,
    Name          NVARCHAR(120)  NOT NULL,
    Description   NVARCHAR(MAX)  NULL,
    MinCapacity   INT            NOT NULL CONSTRAINT DF_Hl_MinCap DEFAULT(20),
    MaxCapacity   INT            NOT NULL CONSTRAINT DF_Hl_MaxCap DEFAULT(100),
    PricePerPlate DECIMAL(10,2)  NOT NULL CONSTRAINT DF_Hl_PPP    DEFAULT(0),
    BaseRent      DECIMAL(10,2)  NOT NULL CONSTRAINT DF_Hl_Rent   DEFAULT(0),
    ImageUrl      NVARCHAR(500)  NULL,
    GalleryJson   NVARCHAR(MAX)  NULL,
    AmenitiesJson NVARCHAR(MAX)  NULL,
    HasAC         BIT            NOT NULL CONSTRAINT DF_Hl_AC        DEFAULT(1),
    HasParking    BIT            NOT NULL CONSTRAINT DF_Hl_Park      DEFAULT(1),
    HasDJ         BIT            NOT NULL CONSTRAINT DF_Hl_DJ        DEFAULT(0),
    IsActive      BIT            NOT NULL CONSTRAINT DF_Hl_Active    DEFAULT(1),
    CreatedAt     DATETIME2(0)   NOT NULL CONSTRAINT DF_Hl_CreatedAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_Hl_Restaurants FOREIGN KEY (RestaurantId) REFERENCES dbo.Restaurants(RestaurantId)
);
GO

CREATE TABLE dbo.HallBookings
(
    BookingId        BIGINT IDENTITY(9001,1) PRIMARY KEY,
    BookingNumber    NVARCHAR(30)   NOT NULL,
    HallId           INT            NOT NULL,
    RestaurantId     INT            NOT NULL,
    UserId           INT            NOT NULL,
    EventType        NVARCHAR(60)   NOT NULL,
    ContactName      NVARCHAR(120)  NOT NULL,
    ContactPhone     NVARCHAR(20)   NOT NULL,
    EventDate        DATE           NOT NULL,
    StartTime        TIME(0)        NOT NULL,
    EndTime          TIME(0)        NOT NULL,
    GuestCount       INT            NOT NULL,
    DecorationTheme  NVARCHAR(120)  NULL,
    CakeRequired     BIT            NOT NULL CONSTRAINT DF_HB_Cake DEFAULT(0),
    CakeFlavour      NVARCHAR(80)   NULL,
    CakeWeightKg     DECIMAL(4,2)   NULL,
    MenuPreference   NVARCHAR(200)  NULL,
    SpecialRequest   NVARCHAR(1000) NULL,
    BaseRent         DECIMAL(12,2)  NOT NULL CONSTRAINT DF_HB_Rent  DEFAULT(0),
    PlateAmount      DECIMAL(12,2)  NOT NULL CONSTRAINT DF_HB_Plate DEFAULT(0),
    DecorationCharge DECIMAL(12,2)  NOT NULL CONSTRAINT DF_HB_Deco  DEFAULT(0),
    DiscountAmount   DECIMAL(12,2)  NOT NULL CONSTRAINT DF_HB_Disc  DEFAULT(0),
    TaxAmount        DECIMAL(12,2)  NOT NULL CONSTRAINT DF_HB_Tax   DEFAULT(0),
    TotalAmount      DECIMAL(12,2)  NOT NULL,
    AdvanceAmount    DECIMAL(12,2)  NOT NULL CONSTRAINT DF_HB_Adv   DEFAULT(0),
    CouponCode       NVARCHAR(40)   NULL,
    Status           NVARCHAR(20)   NOT NULL CONSTRAINT DF_HB_Status  DEFAULT('PENDING'),
    PaymentStatus    NVARCHAR(20)   NOT NULL CONSTRAINT DF_HB_PayStat DEFAULT('PENDING'),
    HandledByUserId  INT            NULL,
    CreatedAt        DATETIME2(0)   NOT NULL CONSTRAINT DF_HB_CreatedAt DEFAULT(SYSUTCDATETIME()),
    UpdatedAt        DATETIME2(0)   NULL,
    CONSTRAINT UQ_HB_Number      UNIQUE (BookingNumber),
    CONSTRAINT FK_HB_Halls       FOREIGN KEY (HallId)       REFERENCES dbo.Halls(HallId),
    CONSTRAINT FK_HB_Restaurants FOREIGN KEY (RestaurantId) REFERENCES dbo.Restaurants(RestaurantId),
    CONSTRAINT FK_HB_Users       FOREIGN KEY (UserId)       REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_HB_Time        CHECK (EndTime > StartTime),
    CONSTRAINT CK_HB_Status      CHECK (Status IN ('PENDING','CONFIRMED','COMPLETED','CANCELLED','REJECTED'))
);
GO
CREATE INDEX IX_HB_Hall_Date ON dbo.HallBookings(HallId, EventDate, Status);
CREATE INDEX IX_HB_User      ON dbo.HallBookings(UserId, CreatedAt DESC);
GO

/* ========================== PAYMENTS =========================== */
CREATE TABLE dbo.Payments
(
    PaymentId        BIGINT IDENTITY(1,1) PRIMARY KEY,
    PaymentRef       NVARCHAR(60)   NOT NULL,
    GatewayName      NVARCHAR(40)   NOT NULL CONSTRAINT DF_Pay_Gateway DEFAULT('MOCK'),
    GatewayOrderId   NVARCHAR(100)  NULL,
    GatewayPaymentId NVARCHAR(100)  NULL,
    GatewaySignature NVARCHAR(400)  NULL,
    UserId           INT            NOT NULL,
    OrderId          BIGINT         NULL,
    HallBookingId    BIGINT         NULL,
    PurposeType      NVARCHAR(20)   NOT NULL,   -- ORDER | HALL
    Amount           DECIMAL(12,2)  NOT NULL,
    Currency         NVARCHAR(10)   NOT NULL CONSTRAINT DF_Pay_Curr   DEFAULT('INR'),
    Method           NVARCHAR(30)   NULL,
    Status           NVARCHAR(20)   NOT NULL CONSTRAINT DF_Pay_Status DEFAULT('CREATED'),
    FailureReason    NVARCHAR(400)  NULL,
    RawPayload       NVARCHAR(MAX)  NULL,
    CreatedAt        DATETIME2(0)   NOT NULL CONSTRAINT DF_Pay_CreatedAt DEFAULT(SYSUTCDATETIME()),
    CompletedAt      DATETIME2(0)   NULL,
    CONSTRAINT UQ_Pay_Ref          UNIQUE (PaymentRef),
    CONSTRAINT FK_Pay_Users        FOREIGN KEY (UserId)        REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_Pay_Orders       FOREIGN KEY (OrderId)       REFERENCES dbo.Orders(OrderId),
    CONSTRAINT FK_Pay_HallBookings FOREIGN KEY (HallBookingId) REFERENCES dbo.HallBookings(BookingId),
    CONSTRAINT CK_Pay_Status       CHECK (Status IN ('CREATED','PAID','FAILED','REFUNDED')),
    CONSTRAINT CK_Pay_Purpose      CHECK (PurposeType IN ('ORDER','HALL'))
);
GO
CREATE INDEX IX_Payments_Order ON dbo.Payments(OrderId);
GO

/* ================ TESTIMONIALS (Happy Customers) =============== */
CREATE TABLE dbo.Testimonials
(
    TestimonialId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerName  NVARCHAR(120)  NOT NULL,
    CustomerImage NVARCHAR(500)  NULL,
    City          NVARCHAR(80)   NULL,
    Designation   NVARCHAR(120)  NULL,
    Rating        DECIMAL(3,2)   NOT NULL CONSTRAINT DF_Ts_Rating    DEFAULT(5),
    Message       NVARCHAR(1000) NOT NULL,
    DisplayOrder  INT            NOT NULL CONSTRAINT DF_Ts_Order     DEFAULT(0),
    IsActive      BIT            NOT NULL CONSTRAINT DF_Ts_Active    DEFAULT(1),
    CreatedAt     DATETIME2(0)   NOT NULL CONSTRAINT DF_Ts_CreatedAt DEFAULT(SYSUTCDATETIME())
);
GO

/* ========================= APP SETTINGS ======================== */
CREATE TABLE dbo.AppSettings
(
    SettingKey   NVARCHAR(80)  NOT NULL PRIMARY KEY,
    SettingValue NVARCHAR(500) NOT NULL,
    Description  NVARCHAR(300) NULL
);
GO

/* ============== TABLE TYPES (TVP for bulk inserts) ============= */
IF TYPE_ID('dbo.OrderItemTableType') IS NOT NULL DROP TYPE dbo.OrderItemTableType;
GO
CREATE TYPE dbo.OrderItemTableType AS TABLE
(
    FoodItemId INT           NOT NULL,
    Quantity   INT           NOT NULL,
    Notes      NVARCHAR(300) NULL
);
GO

IF TYPE_ID('dbo.IntListTableType') IS NOT NULL DROP TYPE dbo.IntListTableType;
GO
CREATE TYPE dbo.IntListTableType AS TABLE (Value INT NOT NULL PRIMARY KEY);
GO

PRINT 'Schema created successfully.';
GO
