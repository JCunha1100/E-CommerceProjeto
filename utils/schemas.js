// utils/schemas.js
// Schemas de validação Zod para todos os endpoints da API

import { z } from 'zod';

// Validação de dados de utilizador (registo, login, atualização)


export const userRegisterSchema = z.object({
  firstName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(50),
  lastName: z.string().max(50).optional(),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Password deve ter pelo menos 8 caracteres'),
  role: z.enum(['USER', 'OWNER', 'ADMIN']).optional().default('USER'),
});

export const userLoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Password é obrigatória'),
});

export const userUpdateSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().max(50).optional(),
  phone: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
}).strict();

// Validação de categorias
export const categoryCreateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  description: z.string().max(500).optional(),
  parentId: z.coerce.number().int().positive().optional(),
}).strict();

export const categoryUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  parentId: z.coerce.number().int().positive().nullable().optional(),
}).strict();

// Validação de marcas
export const brandCreateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url('URL do logo inválida'),
}).strict();

export const brandUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
}).strict();

// Validação de produtos
export const productCreateSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(200),
  slug: z.string().min(1, 'Slug é obrigatório').max(200),
  description: z.string().min(10).max(2000),
  price: z.coerce.number().positive('Preço deve ser positivo'),
  stock: z.coerce.number().int().min(0, 'Stock não pode ser negativo'),
  categoryId: z.coerce.number().int().positive('ID de categoria inválido'),
  brandId: z.coerce.number().int().positive('ID de marca inválido').optional(),
  tempFileName: z.string().optional(),
}).strict();

export const productUpdateSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  slug: z.string().min(1).max(200).optional(),
  description: z.string().min(10).max(2000).optional(),
  price: z.coerce.number().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  stock: z.coerce.number().int().min(0).optional(),
}).strict();

// =====================================================
// PRODUCT VARIANT SCHEMAS
// =====================================================

export const productVariantCreateSchema = z.object({
  productId: z.coerce.number().int().positive('ID de produto inválido'),
  size: z.string().min(1, 'Tamanho é obrigatório').max(50),
  stock: z.coerce.number().int().min(0, 'Stock não pode ser negativo'),
  sku: z.string().min(1, 'SKU é obrigatório').max(100),
  priceAdjustment: z.coerce.number().optional(),
}).strict();

export const productVariantUpdateSchema = z.object({
  size: z.string().min(1).max(50).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  sku: z.string().min(1).max(100).optional(),
  priceAdjustment: z.coerce.number().optional(),
}).strict();

// =====================================================
// PRODUCT IMAGE SCHEMAS
// =====================================================

export const productImageCreateSchema = z.object({
  productId: z.coerce.number().int().positive('ID de produto inválido'),
  url: z.string().url('URL de imagem inválida'),
  isPrimary: z.boolean().optional(),
}).strict();

// =====================================================
// CART SCHEMAS
// =====================================================

export const cartItemAddSchema = z.object({
  productId: z.coerce.number().int().positive('ID de produto inválido'),
  quantity: z.coerce.number().int().positive('Quantidade deve ser pelo menos 1'),
  variantId: z.coerce.number().int().positive().optional(),
}).strict();

export const cartItemUpdateSchema = z.object({
  quantity: z.coerce.number().int().positive('Quantidade deve ser pelo menos 1'),
}).strict();

// =====================================================
// ORDER SCHEMAS
// =====================================================

export const orderCreateSchema = z.object({
  shippingAddress: z.string().min(5, 'Morada de envio deve ter pelo menos 5 caracteres').max(500),
  paymentMethod: z.string().min(1, 'Método de pagamento é obrigatório').max(100),
  notes: z.string().max(500).optional(),
}).strict();

// =====================================================
// ADDRESS SCHEMAS
// =====================================================

export const addressCreateSchema = z.object({
  street: z.string().min(5, 'Rua deve ter pelo menos 5 caracteres').max(200),
  city: z.string().min(2, 'Cidade deve ter pelo menos 2 caracteres').max(100),
  state: z.string().min(2).max(100).optional().nullable(),
  postalCode: z.string().min(2).max(20),
  country: z.string().min(2).max(100).optional(),
  type: z.enum(['billing', 'shipping']),
  isDefault: z.boolean().optional(),
}).strict();

export const addressUpdateSchema = z.object({
  street: z.string().min(5).max(200).optional(),
  city: z.string().min(2).max(100).optional(),
  state: z.string().min(2).max(100).optional().nullable(),
  postalCode: z.string().min(2).max(20).optional(),
  country: z.string().min(2).max(100).optional(),
  type: z.enum(['billing', 'shipping']).optional(),
  isDefault: z.boolean().optional(),
}).strict();

// =====================================================
// WISHLIST SCHEMAS
// =====================================================

export const wishlistAddSchema = z.object({
  productId: z.coerce.number().int().positive('ID do produto inválido'),
  variantId: z.coerce.number().int().positive('ID da variante inválido'),
}).strict();

// =====================================================
// USER PROFILE SCHEMAS
// =====================================================

export const userProfileUpdateSchema = z.object({
  firstName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(50).optional(),
  lastName: z.string().max(50).optional(),
  phone: z.string().max(20).optional().nullable(),
  dateOfBirth: z.string().date().optional().nullable(),
}).strict();

export const userChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password atual é obrigatória'),
  newPassword: z.string().min(8, 'Nova password deve ter pelo menos 8 caracteres'),
  confirmPassword: z.string().min(8),
}).strict().refine(data => data.newPassword === data.confirmPassword, {
  message: 'As passwords não coincidem',
  path: ['confirmPassword'],
});

// =====================================================
// ADMIN SCHEMAS
// =====================================================

export const orderStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled'], {
    errorMap: () => ({ message: 'Status de pedido inválido' })
  }),
}).strict();

export const fulfillmentStatusUpdateSchema = z.object({
  fulfillmentStatus: z.enum(['unfulfilled', 'fulfilled', 'partial', 'returned'], {
    errorMap: () => ({ message: 'Status de fulfillment inválido' })
  }),
}).strict();
