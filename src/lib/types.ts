export type Role = 'admin' | 'manager' | 'staff' | 'rider' | 'merchant' | 'customer'

export type SessionUser = {
  id: number
  full_name: string
  email: string
  role: Role
  branch: string | null
  merchant_id: number | null
}

export type ShipmentStatus =
  | 'pending'
  | 'received'
  | 'in_transit'
  | 'arrived_hub'
  | 'out_for_delivery'
  | 'delivered'
  | 'returned'
  | 'cancelled'

export type Shipment = {
  id: number
  tracking_code: string
  sender_name: string
  sender_phone: string
  sender_email: string | null
  sender_address: string | null
  receiver_name: string
  receiver_phone: string
  receiver_email: string | null
  receiver_address: string
  origin_city: string
  destination_city: string
  destination_country: string
  service_type: string
  description: string | null
  quantity: number
  weight_kg: number | null
  declared_value: number
  shipping_fee: number
  cod_amount: number
  payment_status: 'unpaid' | 'paid' | 'cod'
  payment_method: string | null
  status: ShipmentStatus
  current_location: string | null
  merchant_id: number | null
  estimated_delivery: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
  created_by_name?: string | null
  received_by_name?: string | null
  dispatched_by_name?: string | null
  delivered_by_name?: string | null
}

export type ShipmentEvent = {
  id: number
  status: ShipmentStatus
  location: string | null
  note: string | null
  staff_name?: string | null
  created_at: string
}

export type Settings = Record<string, string>

export type Merchant = {
  id: number
  business_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  bank_name: string | null
  account_name: string | null
  account_number: string | null
  notes: string | null
  is_active: number
  created_at: string
}

export type Product = {
  id: number
  merchant_id: number
  sku: string | null
  name: string
  description: string | null
  unit_price: number
  quantity: number
  low_stock_threshold: number
  shelf_location: string | null
  created_at: string
}

export type MovementType = 'received' | 'sold' | 'dispatched' | 'returned' | 'adjustment'

export type StockMovement = {
  id: number
  product_id: number
  merchant_id: number
  type: MovementType
  quantity: number
  unit_price: number
  reference: string | null
  note: string | null
  created_at: string
  product_name?: string
  sku?: string | null
  handled_by_name?: string | null
  tracking_code?: string | null
  business_name?: string
}

export type Transaction = {
  id: number
  type: 'income' | 'expense'
  category: string
  amount: number
  description: string | null
  method: string | null
  reference: string | null
  shipment_id: number | null
  merchant_id: number | null
  handled_by: number | null
  txn_date: string
  created_at: string
  handled_by_name?: string | null
  tracking_code?: string | null
  business_name?: string | null
}

export type Payout = {
  id: number
  merchant_id: number
  amount: number
  method: string | null
  reference: string | null
  note: string | null
  paid_at: string
  handled_by_name?: string | null
}
