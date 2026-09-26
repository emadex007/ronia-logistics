export type Role = 'admin' | 'manager' | 'staff' | 'rider' | 'merchant'

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
