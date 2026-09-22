import { z } from "zod";

const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const phoneRegex = /^\(\d{2}\)\s?\d{4,5}-?\d{4}$/;
const cepRegex = /^\d{5}-?\d{3}$/;

export const customerSchema = z.object({
  name: z.string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .trim(),
  email: z.string()
    .email("E-mail inválido")
    .max(255, "E-mail deve ter no máximo 255 caracteres")
    .trim(),
  phone: z.string()
    .regex(phoneRegex, "Telefone inválido. Use o formato (XX) XXXXX-XXXX")
    .or(z.string().min(10, "Telefone deve ter pelo menos 10 dígitos").max(20)),
  cpf: z.string()
    .regex(cpfRegex, "CPF inválido. Use o formato XXX.XXX.XXX-XX")
    .or(z.string().length(14, "CPF deve ter 14 caracteres")),
});

export const addressSchema = z.object({
  street: z.string()
    .min(3, "Rua deve ter pelo menos 3 caracteres")
    .max(200, "Rua deve ter no máximo 200 caracteres")
    .trim(),
  number: z.string()
    .min(1, "Número é obrigatório")
    .max(20, "Número deve ter no máximo 20 caracteres")
    .trim(),
  complement: z.string()
    .max(100, "Complemento deve ter no máximo 100 caracteres")
    .optional(),
  neighborhood: z.string()
    .min(2, "Bairro deve ter pelo menos 2 caracteres")
    .max(100, "Bairro deve ter no máximo 100 caracteres")
    .trim(),
  city: z.string()
    .min(2, "Cidade deve ter pelo menos 2 caracteres")
    .max(100, "Cidade deve ter no máximo 100 caracteres")
    .trim(),
  state: z.string()
    .length(2, "Estado deve ter 2 caracteres")
    .trim(),
  zipCode: z.string()
    .regex(cepRegex, "CEP inválido. Use o formato XXXXX-XXX")
    .or(z.string().length(9, "CEP deve ter 9 caracteres")),
});

export const checkoutSchema = z.object({
  customer: customerSchema,
  address: addressSchema.optional(),
  deliveryType: z.enum(["pickup", "delivery"]),
  paymentMethod: z.enum(["credit_card", "boleto", "pix", "cash"]),
  notes: z.string().max(500, "Observações devem ter no máximo 500 caracteres").optional(),
});

export type CheckoutFormData = z.infer<typeof checkoutSchema>;
export type CustomerFormData = z.infer<typeof customerSchema>;
export type AddressFormData = z.infer<typeof addressSchema>;

export function validateCheckout(data: {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  deliveryType: "pickup" | "delivery";
  paymentMethod: "credit_card" | "boleto" | "pix" | "cash";
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  notes?: string;
}): { success: true; data: CheckoutFormData } | { success: false; errors: Record<string, string> } {
  const formData = {
    customer: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      cpf: data.cpf,
    },
    address: data.address,
    deliveryType: data.deliveryType,
    paymentMethod: data.paymentMethod,
    notes: data.notes,
  };

  const result = checkoutSchema.safeParse(formData);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join(".");
    errors[path] = err.message;
  });

  return { success: false, errors };
}
