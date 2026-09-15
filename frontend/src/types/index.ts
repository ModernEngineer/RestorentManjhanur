/* ============================================================
   API types - ye shapes .NET API ki stored-procedure output se
   match karte hain (camelCase me convert hoke aate hain).
   ============================================================ */

export interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data?: T;
  errors?: string[] | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/* ============================== AUTH ============================== */

export type Role = 'Admin' | 'Employee' | 'Customer';

export interface Assignment {
  assignmentId: number;
  restaurantId: number;
  restaurantName: string;
  slug?: string;
  thumbnailUrl?: string | null;
  locality?: string;
  city?: string;
  designation: string;
  canManageMenu: boolean;
  canManageOrder: boolean;
  canManageBooking: boolean;
  assignedAt?: string;
  assignedBy?: string | null;
  pendingOrders?: number;
}

export interface AuthUser {
  userId: number;
  fullName: string;
  email: string;
  phone?: string | null;
  role: Role;
  profileImage?: string | null;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  assignedRestaurants: Assignment[];
}

export interface Address {
  addressId: number;
  userId: number;
  label: string;
  addressLine: string;
  landmark?: string | null;
  city: string;
  pincode?: string | null;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  createdAt: string;
}

/* =========================== RESTAURANTS ========================== */

export interface Restaurant {
  restaurantId: number;
  name: string;
  slug: string;
  tagline?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  coverImageUrl?: string | null;
  addressLine: string;
  locality: string;
  city: string;
  pincode?: string | null;
  latitude: number;
  longitude: number;
  phone?: string | null;
  costForTwo: number;
  rating: number;
  totalReviews: number;
  openingTime: string;
  closingTime: string;
  deliveryRadiusKm: number;
  avgPrepTimeMin: number;
  isPureVeg: boolean;
  hasOutdoorSeating: boolean;
  isPetFriendly: boolean;
  servesAlcohol: boolean;
  hasTableBooking: boolean;
  hasHallBooking: boolean;
  acceptsOnlineOrder: boolean;
  isPromoted: boolean;
  isActive: boolean;

  /* computed by SP */
  isOpenNow: boolean;
  minutesToClose?: number | null;
  distanceKm?: number | null;
  deliveryFee?: number | null;
  isDeliverable?: boolean;
  etaMinutes?: number | null;
  cuisineNames?: string | null;
  offerText?: string | null;
}

export interface Cuisine {
  cuisineId: number;
  name: string;
  iconUrl?: string | null;
  restaurantCount?: number;
}

export interface Locality {
  city: string;
  locality: string;
  restaurantCount: number;
}

export interface DeliverabilityCheck {
  restaurantId: number;
  name: string;
  deliveryRadiusKm: number;
  distanceKm: number;
  isDeliverable: boolean;
  deliveryFee: number;
  etaMinutes: number;
  isOpenNow: boolean;
}

/* =============================== MENU ============================= */

export interface FoodCategory {
  categoryId: number;
  restaurantId?: number | null;
  name: string;
  displayOrder: number;
  itemCount?: number;
  isActive?: boolean;
}

export interface FoodItem {
  foodItemId: number;
  restaurantId: number;
  restaurantName?: string;
  restaurantSlug?: string;
  categoryId?: number | null;
  categoryName?: string | null;
  name: string;
  description?: string | null;
  price: number;
  discountPrice?: number | null;
  effectivePrice: number;
  discountPercent: number;
  imageUrl?: string | null;
  isVeg: boolean;
  isBestseller: boolean;
  isAvailable: boolean;
  rating: number;
  totalReviews: number;
  servesCount?: string | null;
  displayOrder: number;
  isActive?: boolean;
  distanceKm?: number | null;
}

/* ============================== ORDERS ============================ */

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REJECTED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface Order {
  orderId: number;
  orderNumber: string;
  userId: number;
  customerName?: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  restaurantId: number;
  restaurantName: string;
  restaurantSlug?: string;
  restaurantImage?: string | null;
  restaurantPhone?: string | null;
  locality?: string;
  city?: string;
  deliveryAddress: string;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  distanceKm: number;
  subTotal: number;
  discountAmount: number;
  deliveryFee: number;
  packagingFee: number;
  taxAmount: number;
  totalAmount: number;
  couponCode?: string | null;
  orderType: 'DELIVERY' | 'PICKUP';
  status: OrderStatus;
  paymentMode: 'ONLINE' | 'COD';
  paymentStatus: PaymentStatus;
  deliveryEmployeeId?: number | null;
  deliveryPersonName?: string | null;
  deliveryPersonPhone?: string | null;
  customerNote?: string | null;
  cancelReason?: string | null;
  etaMinutes?: number | null;
  placedAt: string;
  deliveredAt?: string | null;
  itemCount?: number;
  itemSummary?: string | null;
}

export interface OrderItem {
  orderItemId: number;
  foodItemId: number;
  itemName: string;
  itemImage?: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  notes?: string | null;
  isVeg?: boolean;
}

export interface OrderTimelineEntry {
  historyId: number;
  status: OrderStatus;
  remarks?: string | null;
  changedAt: string;
  changedBy?: string | null;
}

export interface OrderDetail {
  order: Order;
  items: OrderItem[];
  timeline: OrderTimelineEntry[];
  payments: Payment[];
}

export interface OrderSummary {
  orderId: number;
  orderNumber: string;
  subTotal: number;
  discountAmount: number;
  deliveryFee: number;
  packagingFee: number;
  taxAmount: number;
  totalAmount: number;
  distanceKm: number;
  etaMinutes: number;
  message: string;
}

/* ============================== CART ============================== */

export interface CartLine {
  foodItemId: number;
  name: string;
  price: number;
  imageUrl?: string | null;
  isVeg: boolean;
  quantity: number;
  notes?: string;
}

export interface CartState {
  restaurantId: number | null;
  restaurantName: string | null;
  restaurantSlug: string | null;
  lines: CartLine[];
}

/* ============================= COUPONS ============================ */

export interface Coupon {
  couponId: number;
  code: string;
  title: string;
  description?: string | null;
  discountType: 'PERCENT' | 'FLAT';
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  restaurantId?: number | null;
  restaurantName?: string | null;
  appliesTo: 'ORDER' | 'TABLE' | 'HALL';
  validFrom: string;
  validTo: string;
  usageLimit?: number | null;
  usageLimitPerUser?: number | null;
  usedCount?: number;
  isActive?: boolean;
  computedStatus?: 'LIVE' | 'EXPIRED' | 'SCHEDULED' | 'INACTIVE' | 'EXHAUSTED';
}

export interface CouponValidation {
  isValid: boolean;
  discountAmount: number;
  message: string;
  couponId?: number | null;
}

/* ============================ PAYMENTS ============================ */

export interface Payment {
  paymentId: number;
  paymentRef: string;
  gatewayName: string;
  gatewayPaymentId?: string | null;
  userId?: number;
  customerName?: string;
  customerEmail?: string;
  orderId?: number | null;
  orderNumber?: string | null;
  hallBookingId?: number | null;
  hallBookingNumber?: string | null;
  purposeType: 'ORDER' | 'HALL';
  amount: number;
  currency: string;
  method?: string | null;
  status: 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED';
  failureReason?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface PaymentIntent {
  paymentRef: string;
  gatewayOrderId: string;
  keyId: string;
  amount: number;
  currency: string;
  provider: string;
  receipt: string;
}

export interface MockCheckoutResult {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  signature: string;
  method: string;
  simulatedFailure: boolean;
}

/* ============================= REVIEWS ============================ */

export interface Review {
  reviewId: number;
  restaurantId: number;
  restaurantName?: string;
  restaurantSlug?: string;
  userId: number;
  userName: string;
  userImage?: string | null;
  orderId?: number | null;
  orderNumber?: string | null;
  rating: number;
  foodRating?: number | null;
  serviceRating?: number | null;
  title?: string | null;
  comment?: string | null;
  imageUrl?: string | null;
  likeCount: number;
  isApproved?: boolean;
  createdAt: string;
}

export interface RatingBreakdown {
  stars: number;
  countOfReviews: number;
}

export interface Testimonial {
  testimonialId: number;
  customerName: string;
  customerImage?: string | null;
  city?: string | null;
  designation?: string | null;
  rating: number;
  message: string;
  displayOrder: number;
  isActive?: boolean;
}

/* ============================ BOOKINGS ============================ */

export type TableBookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SEATED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export type HallBookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export interface RestaurantTable {
  tableId: number;
  restaurantId: number;
  tableNumber: string;
  seatCapacity: number;
  location: string;
  isActive: boolean;
  isAvailable?: boolean;
}

export interface TableBooking {
  bookingId: number;
  bookingNumber: string;
  restaurantId: number;
  restaurantName: string;
  restaurantImage?: string | null;
  locality?: string;
  city?: string;
  userId: number;
  customerName?: string;
  tableId?: number | null;
  tableNumber?: string | null;
  tableLocation?: string | null;
  seatCapacity?: number | null;
  guestName: string;
  guestPhone: string;
  bookingDate: string;
  bookingTime: string;
  durationMin: number;
  guestCount: number;
  seatingPref?: string | null;
  occasion?: string | null;
  specialRequest?: string | null;
  status: TableBookingStatus;
  handledBy?: string | null;
  createdAt: string;
}

export interface Hall {
  hallId: number;
  restaurantId: number;
  restaurantName: string;
  restaurantSlug?: string;
  restaurantPhone?: string | null;
  /* usp_Hall_GetById restaurant ki location bhi bhejti hai */
  addressLine?: string;
  locality?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  restaurantRating?: number;
  name: string;
  description?: string | null;
  minCapacity: number;
  maxCapacity: number;
  pricePerPlate: number;
  baseRent: number;
  imageUrl?: string | null;
  galleryJson?: string | null;
  amenitiesJson?: string | null;
  hasAC: boolean;
  hasParking: boolean;
  hasDJ: boolean;
  isActive?: boolean;
  completedEvents?: number;
}

export interface HallBusySlot {
  eventDate: string;
  startTime: string;
  endTime: string;
  eventType: string;
  status?: string;
}

export interface HallQuote {
  isValid: boolean;
  baseRent: number;
  pricePerPlate: number;
  guestCount: number;
  plateAmount: number;
  decorationCharge: number;
  cakeCharge: number;
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  advancePayable: number;
  message: string;
}

export interface HallBooking {
  bookingId: number;
  bookingNumber: string;
  hallId: number;
  hallName: string;
  hallImage?: string | null;
  restaurantId: number;
  restaurantName: string;
  locality?: string;
  city?: string;
  userId: number;
  customerName?: string;
  eventType: string;
  contactName: string;
  contactPhone: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  decorationTheme?: string | null;
  cakeRequired: boolean;
  cakeFlavour?: string | null;
  cakeWeightKg?: number | null;
  menuPreference?: string | null;
  specialRequest?: string | null;
  baseRent: number;
  plateAmount: number;
  decorationCharge: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  advanceAmount: number;
  advancePayable?: number;
  couponCode?: string | null;
  status: HallBookingStatus;
  paymentStatus: PaymentStatus;
  handledBy?: string | null;
  createdAt: string;
}

/* ============================ EMPLOYEES =========================== */

export interface Employee {
  userId: number;
  fullName: string;
  email: string;
  phone?: string | null;
  profileImage?: string | null;
  isActive: boolean;
  createdAt: string;
  assignedRestaurantCount: number;
  assignedRestaurants?: string | null;
  designations?: string | null;
  deliveredOrders: number;
}

export interface AdminRestaurantRow {
  restaurantId: number;
  name: string;
  slug: string;
  thumbnailUrl?: string | null;
  locality: string;
  city: string;
  costForTwo: number;
  rating: number;
  totalReviews: number;
  isActive: boolean;
  isPromoted: boolean;
  hasTableBooking: boolean;
  hasHallBooking: boolean;
  deliveryRadiusKm: number;
  openingTime: string;
  closingTime: string;
  createdAt: string;
  menuItemCount: number;
  orderCount: number;
  employeeCount: number;
}

/* =========================== DASHBOARDS =========================== */

export interface AdminKpi {
  activeRestaurants: number;
  totalCustomers: number;
  activeEmployees: number;
  totalMenuItems: number;
  totalOrders: number;
  todayOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  pendingOrders: number;
  pendingTableBookings: number;
  pendingHallBookings: number;
  pendingReviews: number;
  avgRating: number;
  liveCoupons: number;
}

export interface RevenuePoint {
  orderDate: string;
  orderCount: number;
  revenue: number;
}

export interface TopRestaurant {
  restaurantId: number;
  name: string;
  thumbnailUrl?: string | null;
  locality: string;
  city: string;
  rating: number;
  orderCount: number;
  revenue: number;
}

export interface StatusBreakdown {
  status: OrderStatus;
  cnt: number;
  amount: number;
}

export interface TopDish {
  foodItemId: number;
  itemName: string;
  itemImage?: string | null;
  qtySold: number;
  revenue: number;
  restaurantName: string;
}

export interface BookingsSummary {
  tableBookingsInRange: number;
  hallBookingsInRange: number;
  upcomingTableBookings: number;
  upcomingHallBookings: number;
  upcomingHallRevenue: number;
  hallAdvanceCollected: number;
  upcomingBirthdayEvents: number;
}

export interface AdminDashboard {
  kpi: AdminKpi;
  revenueTrend: RevenuePoint[];
  topRestaurants: TopRestaurant[];
  orderStatusBreakdown: StatusBreakdown[];
  topDishes: TopDish[];
  recentOrders: Order[];
  bookingsSummary: BookingsSummary;
}

export interface EmployeeKpi {
  assignedRestaurants: number;
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  pendingTableBookings: number;
  pendingHallBookings: number;
  myActiveDeliveries: number;
  myDeliveredOrders: number;
}

export interface EmployeeRestaurantSnapshot {
  restaurantId: number;
  name: string;
  thumbnailUrl?: string | null;
  locality: string;
  city: string;
  rating: number;
  designation: string;
  canManageMenu: boolean;
  canManageOrder: boolean;
  canManageBooking: boolean;
  pendingOrders: number;
  todayOrders: number;
  outOfStockItems: number;
}

export interface EmployeeDashboard {
  kpi: EmployeeKpi;
  restaurants: EmployeeRestaurantSnapshot[];
  pendingOrders: Order[];
}

/* ============================== HOME ============================== */

export interface HomeCounters {
  restaurantCount: number;
  deliveredOrderCount: number;
  happyCustomerCount: number;
  cuisineCount: number;
  avgRating: number;
  reviewCount: number;
}

export interface CityCount {
  city: string;
  restaurantCount: number;
}

export interface HomeFeed {
  cuisines: Cuisine[];
  topRated: Restaurant[];
  nearby: Restaurant[];
  offers: Coupon[];
  testimonials: Testimonial[];
  counters: HomeCounters;
  cities: CityCount[];
}

export type AppSettings = Record<string, string>;

/* ============================= FILTERS ============================ */

export interface RestaurantFilters {
  search?: string;
  city?: string;
  locality?: string;
  cuisineIds?: string;
  minRating?: number;
  minCostForTwo?: number;
  maxCostForTwo?: number;
  pureVegOnly?: boolean;
  outdoorSeating?: boolean;
  petFriendly?: boolean;
  servesAlcohol?: boolean;
  openNow?: boolean;
  hasOffers?: boolean;
  hasTableBooking?: boolean;
  hasHallBooking?: boolean;
  lat?: number;
  lng?: number;
  maxDistanceKm?: number;
  onlyDeliverable?: boolean;
  sortBy?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface RestaurantDetailPayload {
  restaurant: Restaurant;
  cuisines: Cuisine[];
  categories: FoodCategory[];
  menu: FoodItem[];
  reviews: Review[];
  halls: Hall[];
  offers: Coupon[];
  ratingBreakdown: RatingBreakdown[];
}
