export async function getPublicIP(): Promise<string | undefined> {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    if (!res.ok) return undefined;
    const data = await res.json();
    return data?.ip;
  } catch {
    return undefined;
  }
}
