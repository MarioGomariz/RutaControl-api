import bcrypt from 'bcrypt';

export async function hashPassword(plain: string) {
  console.log('[HASH_PASSWORD] Hasheando contraseña, longitud:', plain?.length);
  const saltRounds = 12;
  const hash = await bcrypt.hash(plain, saltRounds);
  console.log('[HASH_PASSWORD] Hash generado exitosamente, longitud:', hash.length);
  return hash;
}

export async function comparePassword(plain: string, hash: string) {
  console.log('[COMPARE_PASSWORD] Comparando contraseñas');
  console.log('[COMPARE_PASSWORD] Longitud password plano:', plain?.length);
  console.log('[COMPARE_PASSWORD] Longitud hash:', hash?.length);
  console.log('[COMPARE_PASSWORD] Hash recibido:', hash);
  const result = await bcrypt.compare(plain, hash);
  console.log('[COMPARE_PASSWORD] Resultado:', result);
  return result;
}
