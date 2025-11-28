import express, { raw } from 'express';
import cors from 'cors';
import userRoutes from './routes/user.js';
import categoryRoutes from './routes/category.js';
import brandRoutes from './routes/brand.js';
import productRoutes from './routes/product.js';
import searchRoutes from './routes/search.js';
import productVariantRoutes from './routes/productVariant.js';
import productImageRoutes from './routes/productImage.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/order.js';
import addressRoutes from './routes/address.js';
import wishlistRoutes from './routes/wishlist.js';
import adminRoutes from './routes/admin.js';
import paymentRoutes, { handleStripeWebhook } from './routes/payment.js';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do CORS
const corsOptions = {
    // Permite múltiplas origens (desenvolvimento) ou define uma única (produção)
    origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
    // Permitir credenciais (cookies, cabeçalhos de autenticação)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], // Métodos permitidos
    allowedHeaders: ['Content-Type', 'Authorization'], // Cabeçalhos permitidos
};

// 1. Webhook do Stripe deve ser o primeiro, usando o body em raw
app.post('/api/payment/webhook', raw({ type: 'application/json' }), handleStripeWebhook);

// 2. Middleware de CORS (Global)
// O pacote 'cors' trata de todos os cabeçalhos e da lógica de preflight (OPTIONS)
app.use(cors(corsOptions));

// 3. Middlewares de processamento do body (JSON)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Definição de __dirname para servir ficheiros estáticos
const __dirname = path.resolve();

// Servir imagens estáticas de produtos
app.use('/api/images', express.static(path.join(__dirname, 'uploads', 'products')));

// Rotas da API
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/products', productRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/variants', productVariantRoutes);
app.use('/api/product-images', productImageRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);


// Rota base
app.get('/', (req, res) => {
    res.send(`Servidor E-commerce API está a correr na porta ${PORT}!`);
});

// Rota de saúde da API
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Middleware de 404 - Rota não encontrada
app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
});

app.listen(PORT, () => {
    console.log(`API a correr em http://localhost:${PORT}`);
});