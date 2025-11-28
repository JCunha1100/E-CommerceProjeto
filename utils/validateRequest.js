// Middleware para validação de requisições HTTP usando Zod schemas
import { ZodError } from 'zod';

// Retorna um middleware que valida o corpo da requisição contra um schema Zod
// Em caso de sucesso, substitui req.body com os dados validados
// Em caso de erro, retorna detalhes de validação formatados
export const validateRequest = (schema) => {
  return async (req, res, next) => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      // Formata erros Zod em estrutura legível (caminho do campo + mensagem)
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        }));
        return res.status(400).json({
          error: 'Validação falhou',
          details: formattedErrors,
        });
      }
      res.status(500).json({ error: 'Erro ao processar requisição' });
    }
  };
};
