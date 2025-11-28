// Utilitários para cálculos do carrinho de compras

// Calcula o preço total do carrinho multiplicando preço unitário pela quantidade de cada item
export function calculateTotalPrice(items) {
    return items.reduce((total, item) => {
        // Converter Decimal para número
        const itemPrice = typeof item.itemPrice === 'object' 
            ? parseFloat(item.itemPrice.toString()) 
            : parseFloat(item.itemPrice || 0);
        const itemTotal = itemPrice * item.quantity;
        return total + itemTotal;
    }, 0);
}
