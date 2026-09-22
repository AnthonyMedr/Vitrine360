/**
 * Domain types for Customer entity
 * Aligned with OmniGrow CRM integration contracts
 */

export interface DomainCustomer {
  id?: string;
  phone: string; // Primary operational key
  name?: string;
  email?: string;
  document?: string; // CPF/CNPJ
  created_at?: string;
  updated_at?: string;
}

export interface CustomerAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

export interface CustomerWithAddress extends DomainCustomer {
  addresses?: CustomerAddress[];
}
