/**
 * Validadores de Entrada usando Express Validator
 *
 * Valida e sanitiza dados de entrada para proteger contra:
 * - Injeção de código
 * - Dados malformados
 * - Ataques de overflow
 */

const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Middleware para verificar resultados de validação
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => ({
            field: err.path || err.param,
            message: err.msg,
            value: err.value
        }));

        logger.warn('[Validation] Erro de validação', {
            path: req.path,
            errors: errorMessages,
            ip: req.ip
        });

        return res.status(400).json({
            success: false,
            error: 'Dados inválidos',
            details: errorMessages
        });
    }

    next();
};

// ============================================================================
// Validadores de Autenticação
// ============================================================================

const validateLogin = [
    body('username')
        .trim()
        .notEmpty().withMessage('Usuário é obrigatório')
        .isLength({ min: 3, max: 50 }).withMessage('Usuário deve ter entre 3 e 50 caracteres')
        .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('Usuário contém caracteres inválidos'),

    body('password')
        .notEmpty().withMessage('Senha é obrigatória')
        .isLength({ min: 6, max: 100 }).withMessage('Senha deve ter entre 6 e 100 caracteres'),

    handleValidationErrors
];

const validateRequestAccess = [
    body('username')
        .trim()
        .notEmpty().withMessage('Usuário é obrigatório')
        .isLength({ min: 3, max: 50 }).withMessage('Usuário deve ter entre 3 e 50 caracteres')
        .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('Usuário contém caracteres inválidos'),

    body('password')
        .notEmpty().withMessage('Senha é obrigatória')
        .isLength({ min: 6, max: 100 }).withMessage('Senha deve ter entre 6 e 100 caracteres'),

    body('name')
        .trim()
        .notEmpty().withMessage('Nome é obrigatório')
        .isLength({ min: 3, max: 100 }).withMessage('Nome deve ter entre 3 e 100 caracteres')
        .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/).withMessage('Nome contém caracteres inválidos'),

    body('requestedRole')
        .optional()
        .isIn(['admin', 'operator', 'viewer']).withMessage('Perfil inválido'),

    handleValidationErrors
];

const validateCreateUser = [
    body('username')
        .trim()
        .notEmpty().withMessage('Usuário é obrigatório')
        .isLength({ min: 3, max: 50 }).withMessage('Usuário deve ter entre 3 e 50 caracteres')
        .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('Usuário contém caracteres inválidos'),

    body('password')
        .notEmpty().withMessage('Senha é obrigatória')
        .isLength({ min: 6, max: 100 }).withMessage('Senha deve ter entre 6 e 100 caracteres'),

    body('name')
        .trim()
        .notEmpty().withMessage('Nome é obrigatório')
        .isLength({ min: 3, max: 100 }).withMessage('Nome deve ter entre 3 e 100 caracteres'),

    body('role')
        .notEmpty().withMessage('Perfil é obrigatório')
        .isIn(['admin', 'operator', 'viewer']).withMessage('Perfil inválido'),

    handleValidationErrors
];

// ============================================================================
// Validadores de WhatsApp
// ============================================================================

const validateSendMessage = [
    body('to')
        .trim()
        .notEmpty().withMessage('Destinatário é obrigatório')
        .matches(/^\d{10,15}$/).withMessage('Número de telefone inválido (use apenas dígitos, 10-15 caracteres)')
        .isLength({ min: 10, max: 15 }).withMessage('Número deve ter entre 10 e 15 dígitos'),

    body('message')
        .trim()
        .notEmpty().withMessage('Mensagem é obrigatória')
        .isLength({ min: 1, max: 4096 }).withMessage('Mensagem deve ter no máximo 4096 caracteres'),

    handleValidationErrors
];

const validateBulkSend = [
    body('confirmacaoIds')
        .isArray({ min: 1, max: 100 }).withMessage('Deve enviar entre 1 e 100 confirmações')
        .custom((value) => {
            if (!value.every(id => typeof id === 'string' && id.length > 0)) {
                throw new Error('IDs de confirmação inválidos');
            }
            return true;
        }),

    body('templateCode')
        .optional()
        .isString().withMessage('Código do template deve ser texto')
        .isLength({ max: 100 }).withMessage('Código do template muito longo'),

    handleValidationErrors
];

const validatePhoneNumber = [
    param('phoneNumber')
        .trim()
        .notEmpty().withMessage('Número de telefone é obrigatório')
        .matches(/^\d{10,15}$/).withMessage('Número de telefone inválido'),

    handleValidationErrors
];

// ============================================================================
// Validadores de Consultas
// ============================================================================

const validateConsultaId = [
    param('id')
        .trim()
        .notEmpty().withMessage('ID da consulta é obrigatório')
        .isLength({ min: 1, max: 100 }).withMessage('ID inválido'),

    handleValidationErrors
];

const validateConsultaNumero = [
    param('numero')
        .trim()
        .notEmpty().withMessage('Número da consulta é obrigatório')
        .matches(/^\d+$/).withMessage('Número da consulta deve conter apenas dígitos'),

    handleValidationErrors
];

const validateUpdateStatus = [
    body('status')
        .notEmpty().withMessage('Status é obrigatório')
        .isIn(['pending', 'confirmed', 'declined', 'not_scheduled', 'archived'])
        .withMessage('Status inválido'),

    handleValidationErrors
];

// ============================================================================
// Validadores de Query Params
// ============================================================================

const validatePaginationParams = [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 500 }).withMessage('Limit deve ser entre 1 e 500')
        .toInt(),

    query('offset')
        .optional()
        .isInt({ min: 0, max: 100000 }).withMessage('Offset deve ser entre 0 e 100000')
        .toInt(),

    handleValidationErrors
];

const validateTimeParams = [
    query('minutes')
        .optional()
        .isInt({ min: 1, max: 1440 }).withMessage('Minutes deve ser entre 1 e 1440 (24h)')
        .toInt(),

    handleValidationErrors
];

// ============================================================================
// Validadores de Arquivamento
// ============================================================================

const validateArchiveConsulta = [
    param('id')
        .trim()
        .notEmpty().withMessage('ID da consulta é obrigatório'),

    body('motivo')
        .optional()
        .isString().withMessage('Motivo deve ser texto')
        .isLength({ max: 500 }).withMessage('Motivo muito longo'),

    handleValidationErrors
];

// ============================================================================
// Exports
// ============================================================================

module.exports = {
    handleValidationErrors,

    // Auth
    validateLogin,
    validateRequestAccess,
    validateCreateUser,

    // WhatsApp
    validateSendMessage,
    validateBulkSend,
    validatePhoneNumber,

    // Consultas
    validateConsultaId,
    validateConsultaNumero,
    validateUpdateStatus,
    validateArchiveConsulta,

    // Query params
    validatePaginationParams,
    validateTimeParams
};
