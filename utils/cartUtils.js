// Utilitários para cálculos do carrinho de compras

// Calcula o preço total do carrinho multiplicando preço unitário pela quantidade de cada item
export function calculateTotalPrice(items) {
    return items.reduce((total, item) => {
        const itemTotal = parseFloat(item.itemPrice || 0) * item.quantity;
        return total + itemTotal;
    }, 0);
}
