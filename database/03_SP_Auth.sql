/* ============================================================
   ZomatoClone - Stored Procedures : Auth / Users / Addresses
   ============================================================ */
USE ZomatoCloneDb;
GO

/* XML/STRING_AGG aur indexed views ke liye ye settings ON chahiye.
   sqlcmd default me QUOTED_IDENTIFIER OFF rakhta hai, isliye explicit. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.usp_User_Register','P')        IS NOT NULL DROP PROCEDURE dbo.usp_User_Register;
IF OBJECT_ID('dbo.usp_User_GetByEmail','P')      IS NOT NULL DROP PROCEDURE dbo.usp_User_GetByEmail;
IF OBJECT_ID('dbo.usp_User_GetById','P')         IS NOT NULL DROP PROCEDURE dbo.usp_User_GetById;
IF OBJECT_ID('dbo.usp_User_UpdateProfile','P')   IS NOT NULL DROP PROCEDURE dbo.usp_User_UpdateProfile;
IF OBJECT_ID('dbo.usp_User_ChangePassword','P')  IS NOT NULL DROP PROCEDURE dbo.usp_User_ChangePassword;
IF OBJECT_ID('dbo.usp_RefreshToken_Save','P')    IS NOT NULL DROP PROCEDURE dbo.usp_RefreshToken_Save;
IF OBJECT_ID('dbo.usp_RefreshToken_Validate','P')IS NOT NULL DROP PROCEDURE dbo.usp_RefreshToken_Validate;
IF OBJECT_ID('dbo.usp_RefreshToken_Revoke','P')  IS NOT NULL DROP PROCEDURE dbo.usp_RefreshToken_Revoke;
IF OBJECT_ID('dbo.usp_Address_Save','P')         IS NOT NULL DROP PROCEDURE dbo.usp_Address_Save;
IF OBJECT_ID('dbo.usp_Address_ListByUser','P')   IS NOT NULL DROP PROCEDURE dbo.usp_Address_ListByUser;
IF OBJECT_ID('dbo.usp_Address_Delete','P')       IS NOT NULL DROP PROCEDURE dbo.usp_Address_Delete;
GO

/* ---------------------------------------------------------------
   usp_User_Register
   Output: @NewUserId (0 = email already exists)
   --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_User_Register
    @FullName     NVARCHAR(120),
    @Email        NVARCHAR(160),
    @Phone        NVARCHAR(20)  = NULL,
    @PasswordHash NVARCHAR(400),
    @RoleName     NVARCHAR(50)  = N'Customer',
    @NewUserId    INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @Email)
    BEGIN
        SET @NewUserId = 0;
        RETURN;
    END

    DECLARE @RoleId INT = (SELECT RoleId FROM dbo.Roles WHERE RoleName = @RoleName);
    IF @RoleId IS NULL
    BEGIN
        SET @NewUserId = -1;   -- invalid role
        RETURN;
    END

    INSERT INTO dbo.Users (FullName, Email, Phone, PasswordHash, RoleId)
    VALUES (@FullName, @Email, @Phone, @PasswordHash, @RoleId);

    SET @NewUserId = CAST(SCOPE_IDENTITY() AS INT);
END
GO

/* ---------------------------------------------------------------
   usp_User_GetByEmail  (login ke liye - hash bhi return karta hai)
   --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_User_GetByEmail
    @Email NVARCHAR(160)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  u.UserId, u.FullName, u.Email, u.Phone, u.PasswordHash,
            u.RoleId, r.RoleName, u.ProfileImage, u.IsActive, u.CreatedAt
    FROM    dbo.Users u
    JOIN    dbo.Roles r ON r.RoleId = u.RoleId
    WHERE   u.Email = @Email;
END
GO

/* ---------------------------------------------------------------
   usp_User_GetById  (+ assigned restaurants for Employee role)
   Result 1: user
   Result 2: assigned restaurants
   --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_User_GetById
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  u.UserId, u.FullName, u.Email, u.Phone,
            u.RoleId, r.RoleName, u.ProfileImage, u.IsActive, u.CreatedAt
    FROM    dbo.Users u
    JOIN    dbo.Roles r ON r.RoleId = u.RoleId
    WHERE   u.UserId = @UserId;

    SELECT  re.AssignmentId, re.RestaurantId, rs.Name AS RestaurantName,
            rs.Locality, rs.City, re.Designation,
            re.CanManageMenu, re.CanManageOrder, re.CanManageBooking, re.AssignedAt
    FROM    dbo.RestaurantEmployees re
    JOIN    dbo.Restaurants rs ON rs.RestaurantId = re.RestaurantId
    WHERE   re.UserId = @UserId AND re.IsActive = 1;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_User_UpdateProfile
    @UserId       INT,
    @FullName     NVARCHAR(120),
    @Phone        NVARCHAR(20)  = NULL,
    @ProfileImage NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Users
    SET    FullName     = @FullName,
           Phone        = @Phone,
           ProfileImage = ISNULL(@ProfileImage, ProfileImage),
           UpdatedAt    = SYSUTCDATETIME()
    WHERE  UserId = @UserId;

    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

/* --------------------------------------------------------------- */
CREATE PROCEDURE dbo.usp_User_ChangePassword
    @UserId          INT,
    @NewPasswordHash NVARCHAR(400)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Users
    SET    PasswordHash = @NewPasswordHash, UpdatedAt = SYSUTCDATETIME()
    WHERE  UserId = @UserId;

    -- saare purane refresh tokens invalid kar do
    UPDATE dbo.RefreshTokens SET IsRevoked = 1 WHERE UserId = @UserId AND IsRevoked = 0;

    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

/* ===================== REFRESH TOKENS ========================= */
CREATE PROCEDURE dbo.usp_RefreshToken_Save
    @UserId    INT,
    @Token     NVARCHAR(200),
    @ExpiresAt DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;

    -- purane expired tokens cleanup
    DELETE FROM dbo.RefreshTokens
    WHERE  UserId = @UserId AND (ExpiresAt < SYSUTCDATETIME() OR IsRevoked = 1);

    INSERT INTO dbo.RefreshTokens (UserId, Token, ExpiresAt)
    VALUES (@UserId, @Token, @ExpiresAt);

    SELECT CAST(SCOPE_IDENTITY() AS BIGINT) AS TokenId;
END
GO

CREATE PROCEDURE dbo.usp_RefreshToken_Validate
    @Token NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  rt.TokenId, rt.UserId, rt.ExpiresAt,
            u.FullName, u.Email, r.RoleName
    FROM    dbo.RefreshTokens rt
    JOIN    dbo.Users u ON u.UserId = rt.UserId
    JOIN    dbo.Roles r ON r.RoleId = u.RoleId
    WHERE   rt.Token = @Token
      AND   rt.IsRevoked = 0
      AND   rt.ExpiresAt > SYSUTCDATETIME()
      AND   u.IsActive = 1;
END
GO

CREATE PROCEDURE dbo.usp_RefreshToken_Revoke
    @Token  NVARCHAR(200) = NULL,
    @UserId INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.RefreshTokens
    SET    IsRevoked = 1
    WHERE  IsRevoked = 0
      AND (@Token  IS NULL OR Token  = @Token)
      AND (@UserId IS NULL OR UserId = @UserId);

    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

/* ======================== ADDRESSES =========================== */
CREATE PROCEDURE dbo.usp_Address_Save
    @AddressId   INT           = 0,        -- 0 = insert
    @UserId      INT,
    @Label       NVARCHAR(40),
    @AddressLine NVARCHAR(300),
    @Landmark    NVARCHAR(160) = NULL,
    @City        NVARCHAR(80),
    @Pincode     NVARCHAR(10)  = NULL,
    @Latitude    DECIMAL(9,6),
    @Longitude   DECIMAL(9,6),
    @IsDefault   BIT           = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRAN;

    IF @IsDefault = 1
        UPDATE dbo.UserAddresses SET IsDefault = 0 WHERE UserId = @UserId;

    IF @AddressId IS NULL OR @AddressId = 0
    BEGIN
        INSERT INTO dbo.UserAddresses
              (UserId, Label, AddressLine, Landmark, City, Pincode, Latitude, Longitude, IsDefault)
        VALUES(@UserId, @Label, @AddressLine, @Landmark, @City, @Pincode, @Latitude, @Longitude, @IsDefault);

        SET @AddressId = CAST(SCOPE_IDENTITY() AS INT);
    END
    ELSE
    BEGIN
        UPDATE dbo.UserAddresses
        SET    Label = @Label, AddressLine = @AddressLine, Landmark = @Landmark,
               City = @City, Pincode = @Pincode,
               Latitude = @Latitude, Longitude = @Longitude, IsDefault = @IsDefault
        WHERE  AddressId = @AddressId AND UserId = @UserId;
    END

    COMMIT TRAN;

    SELECT @AddressId AS AddressId;
END
GO

CREATE PROCEDURE dbo.usp_Address_ListByUser
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  AddressId, UserId, Label, AddressLine, Landmark, City, Pincode,
            Latitude, Longitude, IsDefault, CreatedAt
    FROM    dbo.UserAddresses
    WHERE   UserId = @UserId AND IsActive = 1
    ORDER BY IsDefault DESC, CreatedAt DESC;
END
GO

CREATE PROCEDURE dbo.usp_Address_Delete
    @AddressId INT,
    @UserId    INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.UserAddresses
    SET    IsActive = 0
    WHERE  AddressId = @AddressId AND UserId = @UserId;

    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

PRINT 'Auth stored procedures created.';
GO
