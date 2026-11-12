# Kurulum Yönergesi (yapay zekâ asistanı için)

> **Bu dosya bir yapay zekâ asistanına (Claude Code vb.) yazılmıştır.**
> Kullanıcı sana "KURULUM-YONERGESI.md dosyasını oku ve uygula" dediyse, aşağıdaki adımları sırayla uygula.
> Amaç: Ajan Ofisi'ni bu kullanıcının bilgisayarına kurmak ve **kullanıcıya göre** uyarlamak.
> Depo hiçbir kişisel ayar taşımaz; adı, modelleri, karakterleri, dili sen kullanıcıya sorup ayarlayacaksın.

## 0. Bu sistem ne?

- **Yönetici:** Claude Code. İşi planlar, alt ajanlara dağıtır, sonucu inceler.
- **Çalışanlar:** Antigravity CLI (`agy`) ajanları. `ask-agy.ps1` sarmalayıcısıyla etkileşimsiz çalışırlar.
- **Ajan Ofisi:** `ofis/server.js` (bağımlılıksız Node sunucusu, http://localhost:4317). Her iş, pastel piksel bir ofiste canlı görünür.
- **Ekip toplantısı:** `toplanti.ps1`. Uzman roller (`ekip/roller/*.md`) projeyi inceler, Raportör tek rapor yazar.
- **Kancalar:** Claude Code'un HTTP kancaları, yöneticinin kendi adımlarını ofise yazar.

## 1. Ön koşulları denetle

Komutları sen çalıştır, sonucu kullanıcıya kısaca söyle. Eksik olanı kurmasını kullanıcıdan iste. Senin kurman gerekirse önce onay al.

| Gereken | Denetim | Not |
| --- | --- | --- |
| Windows 10/11 | — | Betikler PowerShell 5.1 ve Windows bildirimleri kullanır. macOS/Linux için bkz. Bölüm 9. |
| Node.js 18+ | `node -v` | Sunucu için. npm paketi gerekmez. |
| Antigravity CLI | `agy --version` | Kullanıcının kendisi `agy` çalıştırıp Google ile giriş yapmalı. **Girişi sen yapma.** |
| Claude Code | — | Yönetici rolü. |
| Git | `git --version` | İsteğe bağlı. |

## 2. Doğru konumu doğrula

Betikler depoyu **`~/agy-tools`** klasöründe bekler. Bu yol `ofis/server.js` (`TOOLS`) ve `ofis-not.ps1` içinde sabittir.

- Depo başka bir yerdeyse ya kullanıcıdan onay alıp `%USERPROFILE%\agy-tools` klasörüne taşı, ya da bu iki dosyadaki yolu değiştir.
- `ask-agy.ps1` ile `toplanti.ps1` kendi klasörlerini (`$PSScriptRoot`) ya da `~/agy-tools` yolunu kullanır. Yolu değiştirdiysen bu dosyalara da bak.

## 3. Kullanıcıya sor ve kişiselleştir

Şunları **tek seferde** sor:

1. **Ofiste görünecek adı.** Patron karakteri olur.
2. **Hangi modeller var?** `agy models` çıktısını göster, hangilerini kullanmak istediğini sor.
3. **Ajan rolleri.** Hangi model görsel, hangisi zor kod, hangisi hızlı kod işi yapsın?
4. **Karakterlerin görünen adları.** Varsayılanlar komik Türkçe takma adlar; değiştirmek ister mi?
5. **Ekip toplantısı rolleri.** Varsayılan altı uzman kalsın mı, çıkarılacak ya da eklenecek var mı?
6. **Ofis açılışta kendiliğinden başlasın mı, yoksa sadece istenince mi?**

Sonra cevapları uygula:

### 3a. Ad ve ofis ayarları

`ofis/ayarlar.ornek.json` dosyasını `ofis/ayarlar.json` olarak kopyala ve `owner` alanına kullanıcının adını yaz. Bu dosya git'e girmez.

Ad sonradan ofisten de değiştirilebilir: **Ayarlar → Karakterler → Patron (sen) → Adın**.

### 3b. Modeller (kullanıcının modelleri varsayılandan farklıysa)

Model listesi **dört yerde** var; hepsini tutarlı güncelle:

| Dosya | Ne |
| --- | --- |
| `ask-agy.ps1` | `-Model` parametresinin `ValidateSet` listesi, varsayılan model ve ajan adı eşlemesi (`'gemini-4-argon*' { 'Argon' }` gibi `switch` satırları) |
| `ofis/server.js` | `MODELS` kümesi (ofisten verilen işlerde izin verilen modeller) |
| `ofis/static/extras.js` | `MODEL_BASES` (özel rol formundaki model seçenekleri) |
| `ofis/index.html` | "Yeni iş" formundaki ajan ve model seçenekleri (`fAgent`, `fLevel` vb.) |

Ayrıca:
- Ajan karakterleri (`Argon`, `Opus`, `Sonnet`) `ofis/static/agents.js` içindeki `PRESET` nesnesinde tanımlı. Yeni ajan adı kullanacaksan oraya ekle. Masa yerleri `SEATS` dizisinde.
- `ekip/roller/*.md` dosyalarının üstündeki `model:` alanlarını kullanıcının modellerine çevir.
- `ofis/static/extras.js` ve `app.js` içinde "Argon haftalık kota" istatistiği var. Görsel modeli farklıysa `/argon/` desenlerini uyarla ya da bu bölümü kaldır.

### 3c. Karakterler ve dil

- Görünen adlar: `ofis/static/agents.js` → `PRESET[...].label`, `INTERN_NAMES` ve `app.js` içindeki ek Claude adları.
- Görünüm: kıyafet, saç, aksesuar. Ofis ayarlar panelinden de değiştirilebilir.
- Arayüz Türkçe. Kullanıcı başka dil isterse `index.html`, `static/*.js` ve `.ps1` mesajlarını çevir. **Olay türlerini (`type`) ve iç anahtarları çevirme.**

## 4. Yönetici talimatları (CLAUDE.md)

`ornekler/CLAUDE.ornek.md` dosyası, Claude Code'un ajanları nasıl yöneteceğini anlatan bir şablondur.

1. Şablonu kullanıcının seçtiği modellere, ajan adlarına ve diline göre uyarla.
2. Uyarlanmış metni kullanıcının **genel** `~/.claude/CLAUDE.md` dosyasına ekle.
   - Dosya varsa **mevcut içeriği silme**; sonuna yeni bir bölüm olarak ekle.
   - Eklemeden önce kullanıcıya göster ve onay al.

## 5. Claude Code kancaları

`ornekler/claude-kancalar.json` dosyasındaki `hooks` bölümünü kullanıcının `~/.claude/settings.json` dosyasına **birleştir**:

- Dosyayı asla baştan yazma. Mevcut ayarları ve kancaları koru.
- Aynı olay için kanca zaten varsa listeye ekle, eskisini silme.
- Önce yedek al (`settings.json.yedek-<tarih>`), değişikliği kullanıcıya göster, onay al.

Ofis kapalıyken kancalar sessizce başarısız olur; Claude Code'u engellemez.

## 6. Ofisi başlatma

- **Elle:** `ofis\ofisi-ac.cmd` (pencereli) ya da `ofis\ofis-arka-plan.vbs` (penceresiz). Sonra http://localhost:4317 adresini aç.
- **Açılışta otomatik başlasın:** kullanıcı isterse `ofis-arka-plan.vbs` için `shell:startup` klasörüne bir kısayol oluştur. Kullanıcı istemezse oluşturma.
- **Kapatmak:** komut satırında `ofis\server.js` geçen `node.exe` sürecini durdur.
- **Port:** 4317 doluysa `OFIS_PORT` ortam değişkeniyle değiştirilebilir. Kancalardaki adresi de aynı porta çevir.

## 7. Doğrula

1. Duman testini çalıştır: `powershell -File "$HOME\agy-tools\ofis\test-ofis.ps1"`. Ayrı bir portta, geçici olay dosyasıyla çalışır. Hepsi geçmeli.
2. Ofisi aç, kullanıcıya göster: patron karakteri onun adıyla mı görünüyor?
3. Küçük bir deneme işi ver, ör. hızlı modele "test-run klasörüne merhaba.txt yaz". Ofiste karakterin çalıştığını ve raporun `out/` altına düştüğünü doğrula.
4. Kullanıcıya kısa bir özet ver: neler kuruldu, hangi dosyalar değişti, nasıl kullanılır.

## 8. Kurallar (her zaman)

- **Şifre, Google girişi, API anahtarı:** bunları kullanıcı yapar. Sen girme, isteme, dosyaya yazma.
- **Kişisel veri depoya girmez.** `out/`, `ofis/events.jsonl`, `ofis/ayarlar.json`, kuyruk ve kilit dosyaları `.gitignore`'da. Kullanıcı kendi değişikliklerini paylaşmak isterse önce bunların commit'e girmediğini denetle.
- **`-AutoApprove`** yalnızca git altındaki klasörlerde ve kullanıcı onaylarsa kullanılır.
- `agy` etkileşimsiz modda terminal komutlarını reddeder. İş "blocked / İzin gerekti" ile biterse komutu sen çalıştır ya da kullanıcıya sor.
- **Dosya kodlaması:** `.ps1` dosyaları **BOM'lu UTF-8** kalmalı. Aksi halde PowerShell 5.1 Türkçe karakterleri bozar.

## 9. Windows dışı sistemler (isteğe bağlı uyarlama)

Sunucu (`server.js`) ve sayfa platformdan bağımsızdır; Windows'a bağlı kısımlar şunlar:

- `.ps1` betikleri: PowerShell 7 (`pwsh`) kurulursa büyük ölçüde çalışır, ama `$HOME` yolları ve `Start-Process` kullanımı gözden geçirilmeli.
- `server.js` içindeki Windows bildirimleri (toast) ve `powershell.exe` çağrıları.
- `.cmd` / `.vbs` başlatıcılar: yerine kabuk betiği yaz.

Bu uyarlamayı yapacaksan önce kullanıcıya kapsamı söyle, sonra küçük adımlarla ilerle ve duman testini koş.

## Dosya haritası

Ayrıntılı dosya listesi ve bilinen tuzaklar için `README.md` dosyasına bak.
