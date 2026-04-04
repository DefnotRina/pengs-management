export const PRODUCT_TYPES = ["Barquillos", "Barquillon Classic", "Barquillon Flavors"] as const;
export type ProductType = typeof PRODUCT_TYPES[number];

export const STICK_SIZES = ["Regular", "Small"] as const;
export type StickSize = typeof STICK_SIZES[number];

export interface ProductDefinition {
    name: string;
    group: ProductType;
    size: number;
    stickSize: StickSize;
    multiplier: number; // 1.0 for whole, 0.5 for half
    basePrice: number;
}

export const PRODUCTS: ProductDefinition[] = [
    { name: "25s Barquillos", group: "Barquillos", size: 25, stickSize: "Regular", multiplier: 1, basePrice: 45 },
    { name: "17s Barquillos", group: "Barquillos", size: 17, stickSize: "Regular", multiplier: 1, basePrice: 35 },
    { name: "11s Barquillos", group: "Barquillos", size: 11, stickSize: "Regular", multiplier: 1, basePrice: 25 },
    { name: "10s Barquillos", group: "Barquillos", size: 10, stickSize: "Small", multiplier: 1, basePrice: 23 },
    
    // Half-sticks (0.5x multiplier)
    { name: "12s Barquillon", group: "Barquillon Classic", size: 12, stickSize: "Regular", multiplier: 0.5, basePrice: 30 },
    { name: "11s Barquillon", group: "Barquillon Classic", size: 11, stickSize: "Small", multiplier: 0.5, basePrice: 25 },
    
    // Whole sticks (1.0x multiplier, Flavored Variants)
    { name: "11s Classic Barquillon", group: "Barquillon Flavors", size: 11, stickSize: "Regular", multiplier: 1, basePrice: 60 },
    { name: "11s Durian Barquillon", group: "Barquillon Flavors", size: 11, stickSize: "Regular", multiplier: 1, basePrice: 65 },
    { name: "11s Peanut Barquillon", group: "Barquillon Flavors", size: 11, stickSize: "Regular", multiplier: 1, basePrice: 65 },
    { name: "11s Cookies & Cream Barquillon", group: "Barquillon Flavors", size: 11, stickSize: "Regular", multiplier: 1, basePrice: 65 },
];

export const PACK_SIZES = [25, 17, 12, 11, 10] as const;
export type PackSize = typeof PACK_SIZES[number];

export const COOKS = ["Maria", "Juan", "Rosa", "Pedro", "Ana"] as const;

export const EXPENSE_CATEGORIES = ["Operational", "Raw Ingredients", "Supplies", "Giveaway"] as const;

export interface PackingEntry {
    id: string;
    date: string;
    cook: string;
    packSize: PackSize;
    packs: number;
    pieces: number;
}

export interface Order {
    id: string;
    orderNumber: string;
    client: string;
    name?: string; // For giveaways
    notes?: string;
    deadline?: string;
    paymentStatus: "Unpaid" | "Partial" | "Paid" | "Gift";
    orderStatus: "Pending" | "Delivered" | "Packed";
    items: OrderItem[];
    total: number;
    delivered_on?: string;
}

export interface OrderItem {
    packSize: PackSize;
    quantity: number;
    pricePerPack: number;
}

export interface Expense {
    id: string;
    date: string;
    category: string;
    item: string;
    amount: number;
}

export interface ProductStock {
    packSize: PackSize;
    totalPacked: number;
    totalSold: number;
    remaining: number;
}

export interface CookPayroll {
    cook: string;
    totalPieces: number;
    computedPay: number;
}

// Sample data
export const mockPackingEntries: PackingEntry[] = [
    { id: "1", date: "2026-03-19", cook: "Maria", packSize: 25, packs: 48, pieces: 1200 },
    { id: "2", date: "2026-03-19", cook: "Juan", packSize: 17, packs: 30, pieces: 510 },
    { id: "3", date: "2026-03-18", cook: "Rosa", packSize: 11, packs: 55, pieces: 605 },
    { id: "4", date: "2026-03-18", cook: "Pedro", packSize: 10, packs: 60, pieces: 600 },
    { id: "5", date: "2026-03-17", cook: "Ana", packSize: 25, packs: 40, pieces: 1000 },
    { id: "6", date: "2026-03-17", cook: "Maria", packSize: 17, packs: 35, pieces: 595 },
    { id: "7", date: "2026-03-16", cook: "Juan", packSize: 11, packs: 45, pieces: 495 },
    { id: "8", date: "2026-03-16", cook: "Rosa", packSize: 10, packs: 70, pieces: 700 },
];

export const mockOrders: Order[] = [
    {
        id: "1", orderNumber: "ORD-001", client: "Tienda Lopez", deadline: "2026-03-22",
        paymentStatus: "Unpaid", orderStatus: "Pending",
        items: [{ packSize: 25, quantity: 20, pricePerPack: 45 }, { packSize: 17, quantity: 15, pricePerPack: 35 }],
        total: 1425,
    },
    {
        id: "2", orderNumber: "ORD-002", client: "Cafe Manila", deadline: "2026-03-20",
        paymentStatus: "Paid", orderStatus: "Delivered",
        items: [{ packSize: 11, quantity: 50, pricePerPack: 25 }],
        total: 1250,
    },
    {
        id: "3", orderNumber: "ORD-003", client: "Panaderia Santos", deadline: "2026-03-25",
        paymentStatus: "Partial", orderStatus: "Pending",
        items: [{ packSize: 10, quantity: 30, pricePerPack: 20 }, { packSize: 25, quantity: 10, pricePerPack: 45 }],
        total: 1050,
    },
];

export const mockExpenses: Expense[] = [
    { id: "1", date: "2026-03-19", category: "Raw Material", item: "Flour (25kg)", amount: 850 },
    { id: "2", date: "2026-03-19", category: "Raw Material", item: "Brown Sugar (10kg)", amount: 450 },
    { id: "3", date: "2026-03-18", category: "Operational", item: "Gas Tank", amount: 1200 },
    { id: "4", date: "2026-03-17", category: "Raw Material", item: "Eggs (10 trays)", amount: 2000 },
    { id: "5", date: "2026-03-16", category: "Operational", item: "Packaging Materials", amount: 600 },
];

export const mockProductStock: ProductStock[] = [
    { packSize: 25, totalPacked: 88, totalSold: 30, remaining: 58 },
    { packSize: 17, totalPacked: 65, totalSold: 15, remaining: 50 },
    { packSize: 11, totalPacked: 100, totalSold: 50, remaining: 50 },
    { packSize: 10, totalPacked: 130, totalSold: 30, remaining: 100 },
];

export const mockCookPayroll: CookPayroll[] = [
    { cook: "Maria", totalPieces: 1795, computedPay: 3590 },
    { cook: "Juan", totalPieces: 1005, computedPay: 2010 },
    { cook: "Rosa", totalPieces: 1305, computedPay: 2610 },
    { cook: "Pedro", totalPieces: 600, computedPay: 1200 },
    { cook: "Ana", totalPieces: 1000, computedPay: 2000 },
];

// Dashboard summary
export const dashboardSummary = {
    totalPacks: 383,
    totalPieces: 5705,
    totalIncome: 3725,
    totalExpenses: 5100,
    profit: -1375,
    pendingOrders: 2,
};

// Chart data
export const packsBySize = [
    { name: "25 pcs", packs: 88, fill: "hsl(25, 95%, 53%)" },
    { name: "17 pcs", packs: 65, fill: "hsl(25, 95%, 63%)" },
    { name: "11 pcs", packs: 100, fill: "hsl(25, 95%, 73%)" },
    { name: "10 pcs", packs: 130, fill: "hsl(25, 95%, 43%)" },
];

export const productionByCook = [
    { cook: "Maria", pieces: 1795 },
    { cook: "Juan", pieces: 1005 },
    { cook: "Rosa", pieces: 1305 },
    { cook: "Pedro", pieces: 600 },
    { cook: "Ana", pieces: 1000 },
];
