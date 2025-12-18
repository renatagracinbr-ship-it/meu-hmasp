/**
 * Firebase Configuration - Meu HMASP
 *
 * IMPORTANTE: Substitua as credenciais abaixo pelas do seu projeto Firebase
 *
 * Para obter as credenciais:
 * 1. Acesse https://console.firebase.google.com
 * 2. Crie ou selecione um projeto
 * 3. Va em Configuracoes do Projeto > Seus apps > Web
 * 4. Copie as credenciais do firebaseConfig
 *
 * Para Push Notifications (FCM):
 * 1. Va em Configuracoes do Projeto > Cloud Messaging
 * 2. Gere a chave VAPID (Web Push certificates)
 * 3. Copie a chave e cole no VAPID_KEY abaixo
 */

// Configuracao do Firebase - Meu HMASP
export const firebaseConfig = {
    apiKey: "AIzaSyCWQZfM_OIOFgTDIwoiuCIZisHZpywtgJs",
    authDomain: "meu-hmasp.firebaseapp.com",
    projectId: "meu-hmasp",
    storageBucket: "meu-hmasp.firebasestorage.app",
    messagingSenderId: "765044008220",
    appId: "1:765044008220:web:624f870a42a3582bab86d9"
};

// Chave VAPID para Web Push (FCM)
// Gere em: Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
export const VAPID_KEY = "SUA_CHAVE_VAPID_AQUI";

// Verifica se as credenciais foram configuradas
export function isFirebaseConfigured() {
    return firebaseConfig.apiKey !== "SUA_API_KEY_AQUI";
}

// Verifica se FCM esta configurado
export function isFCMConfigured() {
    return VAPID_KEY !== "SUA_CHAVE_VAPID_AQUI" && VAPID_KEY.length > 10;
}
