/**
 * Auth Service - Meu HMASP
 *
 * Servico de autenticacao usando Firebase Auth
 * Suporta login com telefone (SMS) ou email
 */

import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
} from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigured } from '../config/firebase.config.js';

// Inicializa Firebase
let app = null;
let auth = null;
let recaptchaVerifier = null;
let confirmationResult = null;

/**
 * Inicializa o servico de autenticacao
 */
export function initAuth() {
    if (!isFirebaseConfigured()) {
        console.warn('[Auth] Firebase nao configurado. Usando modo offline.');
        return false;
    }

    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        auth.languageCode = 'pt-BR';
        console.log('[Auth] Firebase inicializado com sucesso');
        return true;
    } catch (error) {
        console.error('[Auth] Erro ao inicializar Firebase:', error);
        return false;
    }
}

/**
 * Configura o reCAPTCHA para autenticacao por telefone
 * @param {string} containerId - ID do elemento container do reCAPTCHA
 */
export function setupRecaptcha(containerId) {
    if (!auth) {
        console.warn('[Auth] Firebase nao inicializado');
        return null;
    }

    try {
        recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
            size: 'invisible',
            callback: () => {
                console.log('[Auth] reCAPTCHA verificado');
            },
            'expired-callback': () => {
                console.log('[Auth] reCAPTCHA expirado');
            }
        });
        return recaptchaVerifier;
    } catch (error) {
        console.error('[Auth] Erro ao configurar reCAPTCHA:', error);
        return null;
    }
}

/**
 * Envia codigo SMS para o telefone
 * @param {string} phoneNumber - Numero no formato +55XXXXXXXXXXX
 */
export async function sendSmsCode(phoneNumber) {
    if (!auth || !recaptchaVerifier) {
        throw new Error('Firebase ou reCAPTCHA nao configurado');
    }

    // Formata numero se necessario
    const formattedPhone = formatPhoneNumber(phoneNumber);

    try {
        confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);
        console.log('[Auth] SMS enviado para:', formattedPhone);
        return true;
    } catch (error) {
        console.error('[Auth] Erro ao enviar SMS:', error);
        throw error;
    }
}

/**
 * Verifica o codigo SMS
 * @param {string} code - Codigo de 6 digitos recebido por SMS
 */
export async function verifySmsCode(code) {
    if (!confirmationResult) {
        throw new Error('Nenhum codigo SMS pendente');
    }

    try {
        const result = await confirmationResult.confirm(code);
        console.log('[Auth] Usuario autenticado:', result.user.uid);
        return result.user;
    } catch (error) {
        console.error('[Auth] Codigo invalido:', error);
        throw error;
    }
}

/**
 * Login com email e senha
 * @param {string} email
 * @param {string} password
 */
export async function loginWithEmail(email, password) {
    if (!auth) {
        throw new Error('Firebase nao inicializado');
    }

    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        console.log('[Auth] Login com email:', result.user.email);
        return result.user;
    } catch (error) {
        console.error('[Auth] Erro no login:', error);
        throw error;
    }
}

/**
 * Cria conta com email e senha
 * @param {string} email
 * @param {string} password
 * @param {string} displayName - Nome do usuario
 */
export async function createAccount(email, password, displayName) {
    if (!auth) {
        throw new Error('Firebase nao inicializado');
    }

    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);

        // Atualiza o nome do usuario
        if (displayName) {
            await updateProfile(result.user, { displayName });
        }

        console.log('[Auth] Conta criada:', result.user.email);
        return result.user;
    } catch (error) {
        console.error('[Auth] Erro ao criar conta:', error);
        throw error;
    }
}

/**
 * Faz logout
 */
export async function logout() {
    if (!auth) {
        // Modo offline - limpa localStorage
        localStorage.removeItem('meuHmasp_user');
        return true;
    }

    try {
        await signOut(auth);
        localStorage.removeItem('meuHmasp_user');
        console.log('[Auth] Logout realizado');
        return true;
    } catch (error) {
        console.error('[Auth] Erro no logout:', error);
        throw error;
    }
}

/**
 * Observa mudancas no estado de autenticacao
 * @param {Function} callback - Funcao chamada quando o estado muda
 */
export function onAuthChange(callback) {
    if (!auth) {
        console.warn('[Auth] Firebase nao inicializado');
        return () => {};
    }

    return onAuthStateChanged(auth, (user) => {
        callback(user);
    });
}

/**
 * Retorna o usuario atual
 */
export function getCurrentUser() {
    if (!auth) {
        // Modo offline - retorna do localStorage
        const saved = localStorage.getItem('meuHmasp_user');
        return saved ? JSON.parse(saved) : null;
    }

    return auth.currentUser;
}

/**
 * Verifica se o usuario esta autenticado
 */
export function isAuthenticated() {
    const user = getCurrentUser();
    return !!user;
}

/**
 * Formata numero de telefone para padrao E.164
 * @param {string} phone - Numero no formato brasileiro
 */
function formatPhoneNumber(phone) {
    // Remove tudo que nao e numero
    const numbers = phone.replace(/\D/g, '');

    // Se ja comeca com 55, adiciona +
    if (numbers.startsWith('55')) {
        return '+' + numbers;
    }

    // Adiciona +55
    return '+55' + numbers;
}

/**
 * Retorna mensagem de erro amigavel
 * @param {string} errorCode - Codigo de erro do Firebase
 */
export function getErrorMessage(errorCode) {
    const messages = {
        'auth/invalid-phone-number': 'Numero de telefone invalido',
        'auth/invalid-verification-code': 'Codigo de verificacao invalido',
        'auth/code-expired': 'Codigo expirado. Solicite um novo.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
        'auth/user-not-found': 'Usuario nao encontrado',
        'auth/wrong-password': 'Senha incorreta',
        'auth/email-already-in-use': 'Este email ja esta em uso',
        'auth/weak-password': 'Senha muito fraca. Use pelo menos 6 caracteres.',
        'auth/invalid-email': 'Email invalido',
        'auth/network-request-failed': 'Erro de conexao. Verifique sua internet.'
    };

    return messages[errorCode] || 'Erro desconhecido. Tente novamente.';
}
