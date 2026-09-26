import { initializeApp } from 'firebase/app';
import { resolverAmbienteV2 } from './ambiente-v2.js';
import { getAuth, connectAuthEmulator, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

let services;
export async function ambienteGestaoV2() {
  const config = resolverAmbienteV2(import.meta.env, location);
  if (!services) services = (async () => {
    const app = initializeApp(config.firebase, 'gestao-v2');
    const auth = getAuth(app), fn = getFunctions(app, 'us-central1'), db = getFirestore(app);
    if (config.local) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      connectFunctionsEmulator(fn, '127.0.0.1', 5001);
    }
    await setPersistence(auth, browserSessionPersistence);
    return { auth, db, local: config.local, call: async (name, data) => (await httpsCallable(fn, name, { timeout: 12000 })(data)).data };
  })();
  return services;
}
