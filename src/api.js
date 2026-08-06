export const API_URL = import.meta.env.VITE_GAS_URL || '';

export const callApi = async (data) => {
  if (!API_URL) {
    throw new Error("URL API (VITE_GAS_URL) belum diatur di file .env");
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(data),
    });
    
    const rawText = await response.text();
    let result;

    try {
      result = JSON.parse(rawText);
    } catch {
      console.error("Gagal mengurai respons menjadi JSON. Respons dari server:", rawText);
      
      // Deteksi respons HTML (misal: halaman login akun Google, otorisasi, atau halaman error Apps Script)
      if (rawText.includes('<html') || rawText.includes('<!DOCTYPE') || rawText.includes('<!doctype')) {
        if (rawText.includes('accounts.google.com') || rawText.includes('ServiceLogin') || rawText.includes('Sign in')) {
          throw new Error("Akses Google Apps Script ditolak (Membutuhkan Login Google). Pastikan opsi 'Who has access' (Siapa saja yang memiliki akses) saat deploy Web App diatur ke 'Anyone' (Siapa saja).");
        }
        if (rawText.includes('Authorization is required') || rawText.includes('otorisasi') || rawText.includes('Otorisasi')) {
          throw new Error("Google Apps Script membutuhkan otorisasi baru. Buka Apps Script editor, lalu jalankan fungsi 'doGet' atau 'doPost' secara manual untuk memberi persetujuan izin akses (authorize).");
        }
        if (rawText.includes('Exception:') || rawText.includes('Error:')) {
          const match = rawText.match(/(?:Exception|Error):\s*([^<]+)/i);
          if (match && match[1]) {
            throw new Error(`Error dari Google Apps Script: ${match[1].trim()}`);
          }
        }
        throw new Error("Server mengembalikan halaman HTML/Error bukan data JSON. Pastikan deployment Web App Google Apps Script aktif dengan akses 'Anyone' (Siapa saja) dan URL VITE_GAS_URL di file .env sudah benar.");
      }
      
      throw new Error(`Respons dari server tidak valid (bukan format JSON): ${rawText.slice(0, 60)}...`);
    }

    if (!result.success) {
      throw new Error(result.error || "Terjadi kesalahan pada server");
    }
    
    return result;
  } catch (err) {
    console.error("API Error:", err);
    throw err;
  }
};
