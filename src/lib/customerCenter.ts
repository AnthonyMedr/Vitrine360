import type { CartItem } from "@/contexts/CartContext";
import type { Product } from "@/hooks/useProducts";
import type { LocalOrder, LocalUser } from "@/lib/localCommerce";
import { apiFetch } from "@/lib/api";

export type CustomerType = "retail" | "pro" | "business";
export type CustomerOrigin = "web" | "whatsapp" | "instagram" | "showroom" | "store" | "integration";
export type CommunicationChannel = "whatsapp" | "email";
export type ReturnMethod = "exchange" | "credit" | "refund";
export type ReturnStatus = "open" | "review" | "approved" | "awaiting_shipment" | "received" | "completed" | "rejected";

export interface CustomerAddressBookEntry {
  id: string;
  label: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  type: "delivery" | "billing";
  isDefault?: boolean;
}

export interface CustomerSupportTicket {
  id: string;
  orderId?: string;
  subject: string;
  channel: CommunicationChannel;
  message: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  updatedAt: string;
}

export interface CustomerReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  itemId?: string;
  itemName?: string;
  reason: string;
  note: string;
  attachmentUrl?: string;
  method: ReturnMethod;
  status: ReturnStatus;
  createdAt: string;
}

export interface SavedCartRecord {
  id: string;
  name: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}

export interface FavoriteList {
  id: string;
  name: string;
  productIds: string[];
  createdAt: string;
}

export interface ActiveCartRecord {
  items: CartItem[];
  updatedAt: string;
}

export interface CustomerProfile {
  fullName: string;
  email: string;
  phone: string;
  cpfCnpj: string;
  companyName?: string;
  stateRegistration?: string;
  birthDate?: string;
  customerType: CustomerType;
  customerOrigin: CustomerOrigin;
  preferredChannel: CommunicationChannel;
  allowPromotions: boolean;
  preferredStoreId?: string | null;
  preferredStoreName?: string | null;
  firstAssistedBy?: string | null;
  addresses: CustomerAddressBookEntry[];
  activeCart?: ActiveCartRecord | null;
  savedCarts: SavedCartRecord[];
  favorites: string[];
  lists: FavoriteList[];
  returns: CustomerReturnRequest[];
  tickets: CustomerSupportTicket[];
  updated_at?: string;
}

const STORAGE_PREFIX = "gamel-customer-center";

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getScope(user?: LocalUser | null, email?: string) {
  if (user?.id) return user.id;
  if (email?.trim()) return `guest:${email.trim().toLowerCase()}`;
  return "guest:anonymous";
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function profileKey(user?: LocalUser | null, email?: string) {
  return `${STORAGE_PREFIX}:${getScope(user, email)}`;
}

export function getDefaultProfile(user?: LocalUser | null, email?: string): CustomerProfile {
  return {
    fullName: user?.user_metadata?.full_name || "",
    email: user?.email || email || "",
    phone: "",
    cpfCnpj: "",
    customerType: "retail",
    customerOrigin: "web",
    preferredChannel: "whatsapp",
    allowPromotions: false,
    preferredStoreId: user?.user_metadata?.store_id || null,
    preferredStoreName: user?.user_metadata?.store_name || null,
    firstAssistedBy: null,
    addresses: [],
    activeCart: null,
    savedCarts: [],
    favorites: [],
    lists: [],
    returns: [],
    tickets: [],
  };
}

export function getCustomerProfile(user?: LocalUser | null, email?: string) {
  const key = profileKey(user, email);
  const fallback = getDefaultProfile(user, email);
  return readStorage<CustomerProfile>(key, fallback);
}

export function saveCustomerProfile(profile: CustomerProfile, user?: LocalUser | null, email?: string) {
  writeStorage(profileKey(user, email || profile.email), profile);
  void persistProfileToApi(profile, user);
  return profile;
}

async function persistProfileToApiStrict(profile: CustomerProfile, user?: LocalUser | null) {
  if (!user?.id) return profile;
  const next = await apiFetch<CustomerProfile>("/api/customer-center/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
  writeStorage(profileKey(user, next.email), next);
  return next;
}

async function persistProfileToApi(profile: CustomerProfile, user?: LocalUser | null) {
  try {
    return await persistProfileToApiStrict(profile, user);
  } catch {
    return profile;
  }
}

export async function syncCustomerProfileFromServer(user?: LocalUser | null) {
  if (!user?.id) return getCustomerProfile(user);
  try {
    const profile = await apiFetch<CustomerProfile>("/api/customer-center/profile");
    saveCustomerProfile(profile, user, profile.email);
    return profile;
  } catch {
    return getCustomerProfile(user);
  }
}

export function updateCustomerProfile(
  patch: Partial<CustomerProfile>,
  user?: LocalUser | null,
  email?: string,
) {
  const current = getCustomerProfile(user, email);
  const next = { ...current, ...patch };
  saveCustomerProfile(next, user, email || next.email);
  return next;
}

export function addOrUpdateAddress(address: CustomerAddressBookEntry, user?: LocalUser | null, email?: string) {
  const profile = getCustomerProfile(user, email);
  const normalized = address.id ? address : { ...address, id: createId() };
  const addresses = profile.addresses.some((entry) => entry.id === normalized.id)
    ? profile.addresses.map((entry) => (entry.id === normalized.id ? normalized : entry))
    : [...profile.addresses, normalized];
  return updateCustomerProfile({ addresses }, user, email);
}

export function removeAddress(addressId: string, user?: LocalUser | null, email?: string) {
  const profile = getCustomerProfile(user, email);
  return updateCustomerProfile({ addresses: profile.addresses.filter((entry) => entry.id !== addressId) }, user, email);
}

export function updateActiveCartRecord(items: CartItem[], user?: LocalUser | null, email?: string) {
  const nextActiveCart: ActiveCartRecord = {
    items,
    updatedAt: new Date().toISOString(),
  };
  return updateCustomerProfile({ activeCart: nextActiveCart }, user, email);
}

export function clearActiveCartRecord(user?: LocalUser | null, email?: string) {
  return updateCustomerProfile({ activeCart: null }, user, email);
}

export function saveCartRecord(name: string, items: CartItem[], user?: LocalUser | null, email?: string) {
  const profile = getCustomerProfile(user, email);
  const now = new Date().toISOString();
  const record: SavedCartRecord = {
    id: createId(),
    name,
    items,
    createdAt: now,
    updatedAt: now,
  };
  return updateCustomerProfile({ savedCarts: [record, ...profile.savedCarts] }, user, email);
}

export async function saveCartRecordAsync(name: string, items: CartItem[], user?: LocalUser | null, email?: string) {
  const profile = getCustomerProfile(user, email);
  const now = new Date().toISOString();
  const record: SavedCartRecord = {
    id: createId(),
    name,
    items,
    createdAt: now,
    updatedAt: now,
  };
  const next = { ...profile, savedCarts: [record, ...profile.savedCarts] };
  writeStorage(profileKey(user, email || next.email), next);

  if (!user?.id) {
    return { profile: next, persisted: false, reason: "guest" as const };
  }

  try {
    const persisted = await persistProfileToApiStrict(next, user);
    return { profile: persisted, persisted: true as const };
  } catch {
    return { profile: next, persisted: false, reason: "api_error" as const };
  }
}

export function removeSavedCart(cartId: string, user?: LocalUser | null, email?: string) {
  const profile = getCustomerProfile(user, email);
  return updateCustomerProfile({ savedCarts: profile.savedCarts.filter((entry) => entry.id !== cartId) }, user, email);
}

export function toggleFavorite(productId: string, user?: LocalUser | null, email?: string) {
  const profile = getCustomerProfile(user, email);
  const favorites = profile.favorites.includes(productId)
    ? profile.favorites.filter((entry) => entry !== productId)
    : [productId, ...profile.favorites];
  return updateCustomerProfile({ favorites }, user, email);
}

export function saveFavoriteList(name: string, productIds: string[], user?: LocalUser | null, email?: string) {
  const profile = getCustomerProfile(user, email);
  const list: FavoriteList = { id: createId(), name, productIds, createdAt: new Date().toISOString() };
  return updateCustomerProfile({ lists: [list, ...profile.lists] }, user, email);
}

export function removeFavoriteList(listId: string, user?: LocalUser | null, email?: string) {
  const profile = getCustomerProfile(user, email);
  return updateCustomerProfile({ lists: profile.lists.filter((entry) => entry.id !== listId) }, user, email);
}

export function createReturnRequest(
  input: Omit<CustomerReturnRequest, "id" | "status" | "createdAt">,
  user?: LocalUser | null,
  email?: string,
) {
  const profile = getCustomerProfile(user, email);
  const request: CustomerReturnRequest = {
    ...input,
    id: createId(),
    status: "open",
    createdAt: new Date().toISOString(),
  };
  return updateCustomerProfile({ returns: [request, ...profile.returns] }, user, email);
}

export function createSupportTicket(
  input: Omit<CustomerSupportTicket, "id" | "createdAt" | "updatedAt" | "status">,
  user?: LocalUser | null,
  email?: string,
) {
  const profile = getCustomerProfile(user, email);
  const now = new Date().toISOString();
  const ticket: CustomerSupportTicket = {
    ...input,
    id: createId(),
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  return updateCustomerProfile({ tickets: [ticket, ...profile.tickets] }, user, email);
}

export function hydrateProfileFromOrder(order: LocalOrder, user?: LocalUser | null) {
  const profile = getCustomerProfile(user, order.customer_email);
  const address = order.shipping_address
    ? {
        id: createId(),
        label: "Endereço principal",
        street: order.shipping_address.street,
        number: order.shipping_address.number,
        complement: order.shipping_address.complement,
        neighborhood: order.shipping_address.neighborhood,
        city: order.shipping_address.city,
        state: order.shipping_address.state,
        zipCode: order.shipping_address.zipCode,
        type: "delivery" as const,
        isDefault: true,
      }
    : null;

  const nextAddresses = address
    ? [address, ...profile.addresses.filter((entry) => `${entry.street}-${entry.number}-${entry.zipCode}` !== `${address.street}-${address.number}-${address.zipCode}`)]
    : profile.addresses;

  return updateCustomerProfile(
    {
      fullName: order.customer_name || profile.fullName,
      email: order.customer_email || profile.email,
      phone: order.customer_phone || profile.phone,
      cpfCnpj: order.customer_cpf || profile.cpfCnpj,
      addresses: nextAddresses,
    },
    user,
    order.customer_email,
  );
}

export function getFavoriteProducts(products: Product[], profile: CustomerProfile) {
  return products.filter((product) => profile.favorites.includes(product.id));
}
