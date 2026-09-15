import { api, qs } from './client';
import type {
  Address, AdminDashboard, AdminRestaurantRow, AppSettings, Assignment, AuthUser,
  Coupon, CouponValidation, Cuisine, DeliverabilityCheck, Employee, EmployeeDashboard,
  FoodCategory, FoodItem, Hall, HallBooking, HallBusySlot, HallQuote, HomeFeed,
  Locality, MockCheckoutResult, Order, OrderDetail, OrderSummary, PagedResult,
  Payment, PaymentIntent, Restaurant, RestaurantDetailPayload, RestaurantFilters,
  RestaurantTable, Review, TableBooking, Testimonial,
} from '@/types';

/* ================================ AUTH ============================== */

export const authApi = {
  register: (body: { fullName: string; email: string; phone?: string; password: string }) =>
    api.post<AuthUser>('/auth/register', body, { anonymous: true }),

  login: (body: { email: string; password: string }) =>
    api.post<AuthUser>('/auth/login', body, { anonymous: true }),

  logout: (refreshToken?: string) =>
    api.post<null>('/auth/logout', { refreshToken: refreshToken ?? '' }),

  me: () => api.get<{ user: Record<string, unknown>; assignedRestaurants: unknown[] }>('/auth/me'),

  updateProfile: (body: { fullName: string; phone?: string; profileImage?: string }) =>
    api.put<null>('/auth/profile', body),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api.post<null>('/auth/change-password', body),

  addresses: () => api.get<Address[]>('/auth/addresses'),

  saveAddress: (body: Partial<Address>) => api.post<{ addressId: number }>('/auth/addresses', body),

  deleteAddress: (addressId: number) => api.del<null>(`/auth/addresses/${addressId}`),

  uploadProfilePhoto: (file: File) => api.upload<{ url: string }>('/uploads/profile-photo', file),
};

/* ================================ HOME ============================== */

export const homeApi = {
  feed: (params?: { city?: string; lat?: number; lng?: number }) =>
    api.get<HomeFeed>(`/home${qs(params)}`, { anonymous: true }),

  testimonials: (topN?: number) =>
    api.get<Testimonial[]>(`/home/testimonials${qs({ topN })}`, { anonymous: true }),

  settings: () => api.get<AppSettings>('/home/settings', { anonymous: true }),
};

/* ============================ RESTAURANTS =========================== */

export const restaurantApi = {
  search: (filters: RestaurantFilters) =>
    api.get<PagedResult<Restaurant>>(`/restaurants${qs(filters as Record<string, unknown>)}`, {
      anonymous: true,
    }),

  bySlug: (slug: string, params?: { lat?: number; lng?: number }) =>
    api.get<RestaurantDetailPayload>(`/restaurants/${encodeURIComponent(slug)}${qs(params)}`, {
      anonymous: true,
    }),

  byId: (restaurantId: number, params?: { lat?: number; lng?: number }) =>
    api.get<RestaurantDetailPayload>(`/restaurants/id/${restaurantId}${qs(params)}`, {
      anonymous: true,
    }),

  /** 15 km delivery rule ka check */
  deliverable: (restaurantId: number, lat: number, lng: number) =>
    api.get<DeliverabilityCheck>(`/restaurants/${restaurantId}/deliverable${qs({ lat, lng })}`, {
      anonymous: true,
    }),

  cuisines: () => api.get<Cuisine[]>('/restaurants/cuisines', { anonymous: true }),

  localities: (city?: string) =>
    api.get<Locality[]>(`/restaurants/localities${qs({ city })}`, { anonymous: true }),

  searchDishes: (params: { q: string; city?: string; lat?: number; lng?: number; topN?: number }) =>
    api.get<FoodItem[]>(`/restaurants/dishes/search${qs(params)}`, { anonymous: true }),
};

/* =============================== ORDERS ============================= */

export interface PlaceOrderBody {
  restaurantId: number;
  addressId?: number;
  items: { foodItemId: number; quantity: number; notes?: string }[];
  couponCode?: string;
  paymentMode: 'ONLINE' | 'COD';
  orderType: 'DELIVERY' | 'PICKUP';
  customerNote?: string;
}

export const orderApi = {
  place: (body: PlaceOrderBody) => api.post<OrderSummary>('/orders', body),

  my: (params?: { status?: string; pageNumber?: number; pageSize?: number }) =>
    api.get<PagedResult<Order>>(`/orders/my${qs(params)}`),

  detail: (orderId: number) => api.get<OrderDetail>(`/orders/${orderId}`),

  cancel: (orderId: number, remarks?: string) =>
    api.post<null>(`/orders/${orderId}/cancel`, { remarks }),

  reorder: (orderId: number) =>
    api.get<{
      restaurantId: number;
      restaurantName: string;
      restaurantSlug: string;
      items: { foodItemId: number; name: string; image?: string; quantity: number; isAvailable: boolean }[];
      unavailableCount: number;
    }>(`/orders/${orderId}/reorder`),

  validateCoupon: (body: {
    code: string;
    restaurantId?: number;
    orderAmount: number;
    appliesTo?: 'ORDER' | 'TABLE' | 'HALL';
  }) => api.post<CouponValidation>('/orders/validate-coupon', body),

  coupons: (params?: { restaurantId?: number; appliesTo?: string }) =>
    api.get<Coupon[]>(`/orders/coupons${qs(params)}`, { anonymous: true }),
};

/* ============================== PAYMENTS ============================ */

export const paymentApi = {
  create: (body: { orderId?: number; hallBookingId?: number; purposeType: 'ORDER' | 'HALL' }) =>
    api.post<PaymentIntent>('/payments/create', body),

  /** Sirf MOCK gateway ke liye - checkout simulate karke valid signature deta hai */
  mockCheckout: (gatewayOrderId: string, fail = false) =>
    api.post<MockCheckoutResult>(`/payments/mock/checkout${qs({ gatewayOrderId, fail })}`),

  verify: (body: {
    paymentRef: string;
    gatewayOrderId: string;
    gatewayPaymentId: string;
    signature: string;
    method?: string;
  }) =>
    api.post<{ paymentRef: string; status: string; orderId?: number; hallBookingId?: number }>(
      '/payments/verify',
      body,
    ),

  my: (params?: { status?: string; pageNumber?: number; pageSize?: number }) =>
    api.get<PagedResult<Payment>>(`/payments/my${qs(params)}`),
};

/* =========================== TABLE BOOKING ========================== */

export const tableBookingApi = {
  availability: (body: {
    restaurantId: number;
    bookingDate: string;
    bookingTime: string;
    guestCount: number;
    durationMin?: number;
    seatingPref?: string;
  }) =>
    api.post<{ availableTables: RestaurantTable[]; availableCount: number; isAvailable: boolean }>(
      '/table-bookings/availability',
      body,
      { anonymous: true },
    ),

  create: (body: {
    restaurantId: number;
    guestName: string;
    guestPhone: string;
    bookingDate: string;
    bookingTime: string;
    guestCount: number;
    durationMin?: number;
    seatingPref?: string;
    occasion?: string;
    specialRequest?: string;
  }) => api.post<TableBooking & { message: string }>('/table-bookings', body),

  my: (params?: { status?: string; pageNumber?: number; pageSize?: number }) =>
    api.get<PagedResult<TableBooking>>(`/table-bookings/my${qs(params)}`),

  cancel: (bookingId: number) => api.post<null>(`/table-bookings/${bookingId}/cancel`),
};

/* ============================ HALL BOOKING ========================== */

export const hallApi = {
  list: (params?: {
    restaurantId?: number;
    city?: string;
    minGuestCapacity?: number;
    maxBudgetPerPlate?: number;
  }) => api.get<Hall[]>(`/halls${qs(params)}`, { anonymous: true }),

  detail: (hallId: number) =>
    api.get<{ hall: Hall; busySlots: HallBusySlot[] }>(`/halls/${hallId}`, { anonymous: true }),

  availability: (body: { hallId: number; eventDate: string; startTime: string; endTime: string }) =>
    api.post<{ isAvailable: boolean; message: string; busySlots: HallBusySlot[] }>(
      '/halls/availability',
      body,
      { anonymous: true },
    ),

  quote: (body: {
    hallId: number;
    guestCount: number;
    cakeRequired?: boolean;
    cakeWeightKg?: number;
    decorationTheme?: string;
    couponCode?: string;
  }) => api.post<HallQuote>('/halls/quote', body),

  book: (body: {
    hallId: number;
    eventType: string;
    contactName: string;
    contactPhone: string;
    eventDate: string;
    startTime: string;
    endTime: string;
    guestCount: number;
    decorationTheme?: string;
    cakeRequired?: boolean;
    cakeFlavour?: string;
    cakeWeightKg?: number;
    menuPreference?: string;
    specialRequest?: string;
    couponCode?: string;
  }) => api.post<HallBooking & { message: string }>('/halls/bookings', body),

  myBookings: (params?: { status?: string; pageNumber?: number; pageSize?: number }) =>
    api.get<PagedResult<HallBooking>>(`/halls/bookings/my${qs(params)}`),

  cancelBooking: (bookingId: number) => api.post<null>(`/halls/bookings/${bookingId}/cancel`),
};

/* =============================== REVIEWS ============================ */

export const reviewApi = {
  list: (params: {
    restaurantId?: number;
    minRating?: number;
    sortBy?: string;
    pageNumber?: number;
    pageSize?: number;
  }) => api.get<PagedResult<Review>>(`/reviews${qs(params)}`, { anonymous: true }),

  my: (params?: { pageNumber?: number; pageSize?: number }) =>
    api.get<PagedResult<Review>>(`/reviews/my${qs(params)}`),

  add: (body: {
    restaurantId: number;
    orderId?: number;
    rating: number;
    foodRating?: number;
    serviceRating?: number;
    title?: string;
    comment?: string;
    imageUrl?: string;
  }) => api.post<{ reviewId: number; message: string; newRestaurantRating: number }>('/reviews', body),

  like: (reviewId: number) => api.post<{ likeCount: number }>(`/reviews/${reviewId}/like`),
};

/* ================================ ADMIN ============================= */

export const adminApi = {
  dashboard: (params?: { fromDate?: string; toDate?: string }) =>
    api.get<AdminDashboard>(`/admin/dashboard${qs(params)}`),

  /* --- restaurants --- */
  restaurants: (params?: {
    search?: string;
    city?: string;
    isActive?: boolean;
    pageNumber?: number;
    pageSize?: number;
  }) => api.get<PagedResult<AdminRestaurantRow>>(`/admin/restaurants${qs(params)}`),

  saveRestaurant: (body: Record<string, unknown>) =>
    api.post<{ restaurantId: number; slug: string }>('/admin/restaurants', body),

  toggleRestaurant: (restaurantId: number, isActive: boolean) =>
    api.put<null>(`/admin/restaurants/${restaurantId}/toggle`, { isActive }),

  updateRestaurantImages: (
    restaurantId: number,
    body: { thumbnailUrl?: string; coverImageUrl?: string },
  ) => api.put<Restaurant>(`/admin/restaurants/${restaurantId}/images`, body),

  /* --- employees --- */
  employees: (params?: {
    search?: string;
    restaurantId?: number;
    designation?: string;
    isActive?: boolean;
    unassigned?: boolean;
    pageNumber?: number;
    pageSize?: number;
  }) => api.get<PagedResult<Employee>>(`/admin/employees${qs(params)}`),

  saveEmployee: (body: {
    userId?: number;
    fullName: string;
    email: string;
    phone?: string;
    password?: string;
    isActive?: boolean;
  }) => api.post<{ userId: number; message: string }>('/admin/employees', body),

  assignRestaurant: (body: {
    userId: number;
    restaurantId: number;
    designation: string;
    canManageMenu: boolean;
    canManageOrder: boolean;
    canManageBooking: boolean;
  }) => api.post<{ assignmentId: number; message: string }>('/admin/employees/assign', body),

  unassignRestaurant: (userId: number, restaurantId: number) =>
    api.del<null>(`/admin/employees/${userId}/unassign/${restaurantId}`),

  employeeAssignments: (userId: number) =>
    api.get<Assignment[]>(`/admin/employees/${userId}/assignments`),

  toggleEmployee: (userId: number, isActive: boolean) =>
    api.put<null>(`/admin/employees/${userId}/toggle`, { isActive }),

  /* --- coupons --- */
  coupons: (params?: {
    search?: string;
    restaurantId?: number;
    isActive?: boolean;
    pageNumber?: number;
    pageSize?: number;
  }) => api.get<PagedResult<Coupon>>(`/admin/coupons${qs(params)}`),

  saveCoupon: (body: Record<string, unknown>) =>
    api.post<{ couponId: number; message: string }>('/admin/coupons', body),

  toggleCoupon: (couponId: number, isActive: boolean) =>
    api.put<null>(`/admin/coupons/${couponId}/toggle`, { isActive }),

  /* --- reviews --- */
  reviews: (params?: {
    restaurantId?: number;
    isApproved?: boolean;
    pageNumber?: number;
    pageSize?: number;
  }) => api.get<PagedResult<Review>>(`/admin/reviews${qs(params)}`),

  moderateReview: (reviewId: number, isApproved: boolean) =>
    api.put<null>(`/admin/reviews/${reviewId}/moderate`, { isActive: isApproved }),

  /* --- testimonials (happy customers) --- */
  testimonials: () => api.get<Testimonial[]>('/admin/testimonials'),

  saveTestimonial: (body: Partial<Testimonial>) =>
    api.post<{ testimonialId: number }>('/admin/testimonials', body),

  deleteTestimonial: (testimonialId: number) =>
    api.del<null>(`/admin/testimonials/${testimonialId}`),

  /* --- payments --- */
  payments: (params?: {
    status?: string;
    fromDate?: string;
    toDate?: string;
    pageNumber?: number;
    pageSize?: number;
  }) => api.get<PagedResult<Payment>>(`/admin/payments${qs(params)}`),

  /* --- settings --- */
  settings: () =>
    api.get<{ settingKey: string; settingValue: string; description?: string }[]>('/admin/settings'),

  saveSetting: (body: { settingKey: string; settingValue: string; description?: string }) =>
    api.post<null>('/admin/settings', body),
};

/* ========================== MANAGE (admin+emp) ====================== */

export const manageApi = {
  /* --- menu --- */
  menuItems: (params: {
    restaurantId?: number;
    categoryId?: number;
    search?: string;
    vegOnly?: boolean;
    nonVegOnly?: boolean;
    onlyOffers?: boolean;
    includeInactive?: boolean;
    sortBy?: string;
    pageNumber?: number;
    pageSize?: number;
  }) => api.get<PagedResult<FoodItem>>(`/manage/menu/items${qs(params)}`),

  menuItem: (foodItemId: number) => api.get<FoodItem>(`/manage/menu/items/${foodItemId}`),

  saveMenuItem: (body: Record<string, unknown>) =>
    api.post<{ foodItemId: number; message: string }>('/manage/menu/items', body),

  /** Food image URL se change */
  updateItemImageUrl: (foodItemId: number, imageUrl: string) =>
    api.put<FoodItem>(`/manage/menu/items/${foodItemId}/image`, { imageUrl }),

  /** Food image file upload karke change (ek hi call me upload + DB update) */
  uploadItemImage: (foodItemId: number, file: File) =>
    api.upload<{ item: FoodItem; imageUrl: string; sizeBytes: number }>(
      `/manage/menu/items/${foodItemId}/image/upload`,
      file,
    ),

  toggleItemAvailability: (foodItemId: number, isAvailable: boolean) =>
    api.put<null>(`/manage/menu/items/${foodItemId}/availability`, { isActive: isAvailable }),

  deleteItem: (foodItemId: number) => api.del<null>(`/manage/menu/items/${foodItemId}`),

  bulkDiscount: (body: {
    foodItemId?: number;
    restaurantId?: number;
    categoryId?: number;
    discountPercent: number;
    maxPrice?: number;
  }) => api.post<{ affectedItems: number }>('/manage/menu/items/bulk-discount', body),

  categories: (restaurantId?: number) =>
    api.get<FoodCategory[]>(`/manage/menu/categories${qs({ restaurantId })}`),

  saveCategory: (body: { categoryId?: number; restaurantId?: number; name: string; displayOrder?: number; isActive?: boolean }) =>
    api.post<{ categoryId: number }>('/manage/menu/categories', body),

  /* --- orders --- */
  orders: (params: {
    restaurantId?: number;
    status?: string;
    paymentStatus?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
    pageNumber?: number;
    pageSize?: number;
  }) => api.get<PagedResult<Order>>(`/manage/orders${qs(params)}`),

  orderDetail: (orderId: number) => api.get<OrderDetail>(`/manage/orders/${orderId}`),

  updateOrderStatus: (orderId: number, status: string, remarks?: string) =>
    api.put<null>(`/manage/orders/${orderId}/status`, { status, remarks }),

  assignDelivery: (orderId: number, deliveryEmployeeId: number) =>
    api.put<null>(`/manage/orders/${orderId}/assign-delivery`, { deliveryEmployeeId }),

  deliveryStaff: (restaurantId: number) =>
    api.get<Employee[]>(`/manage/orders/delivery-staff${qs({ restaurantId })}`),

  /* --- bookings --- */
  tableBookings: (params: {
    restaurantId?: number;
    status?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
    pageNumber?: number;
    pageSize?: number;
  }) => api.get<PagedResult<TableBooking>>(`/manage/bookings/tables${qs(params)}`),

  updateTableBookingStatus: (bookingId: number, status: string) =>
    api.put<null>(`/manage/bookings/tables/${bookingId}/status`, { status }),

  hallBookings: (params: {
    restaurantId?: number;
    hallId?: number;
    status?: string;
    eventType?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
    pageNumber?: number;
    pageSize?: number;
  }) => api.get<PagedResult<HallBooking>>(`/manage/bookings/halls${qs(params)}`),

  updateHallBookingStatus: (bookingId: number, status: string) =>
    api.put<null>(`/manage/bookings/halls/${bookingId}/status`, { status }),

  halls: (restaurantId?: number) =>
    api.get<Hall[]>(`/manage/bookings/halls/master${qs({ restaurantId })}`),

  saveHall: (body: Record<string, unknown>) =>
    api.post<{ hallId: number; message: string }>('/manage/bookings/halls/master', body),

  uploadHallImage: (hallId: number, file: File) =>
    api.upload<{ hall: Hall; imageUrl: string }>(
      `/manage/bookings/halls/master/${hallId}/image/upload`,
      file,
    ),

  tables: (restaurantId: number) =>
    api.get<RestaurantTable[]>(`/manage/bookings/tables/master${qs({ restaurantId })}`),

  saveTable: (body: {
    tableId?: number;
    restaurantId: number;
    tableNumber: string;
    seatCapacity: number;
    location: string;
    isActive?: boolean;
  }) => api.post<{ tableId: number; message: string }>('/manage/bookings/tables/master', body),
};

/* ============================== EMPLOYEE ============================ */

export const employeeApi = {
  dashboard: () => api.get<EmployeeDashboard>('/employee/dashboard'),

  myRestaurants: () => api.get<Assignment[]>('/employee/my-restaurants'),

  myDeliveries: (params?: { status?: string; pageNumber?: number; pageSize?: number }) =>
    api.get<PagedResult<Order>>(`/employee/my-deliveries${qs(params)}`),

  updateMyDelivery: (orderId: number, status: 'OUT_FOR_DELIVERY' | 'DELIVERED', remarks?: string) =>
    api.put<null>(`/employee/my-deliveries/${orderId}/status`, { status, remarks }),
};

/* ============================== UPLOADS ============================= */

export const uploadApi = {
  image: (folder: 'food' | 'restaurants' | 'halls' | 'profiles' | 'reviews', file: File) =>
    api.upload<{ url: string; fileName: string; sizeBytes: number }>(`/uploads/${folder}`, file),
};
