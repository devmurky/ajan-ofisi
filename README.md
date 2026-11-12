# agy-tools · Ajan Ofisi

Claude Code yönetici, Antigravity CLI (`agy`) ajanları çalışan. Her iş canlı olarak pastel piksel bir ofiste görünür: http://localhost:4317

## Kurulum

Depo hiçbir kişisel ayar içermez; kurulumu ve kişiselleştirmeyi kendi yapay zekâ asistanın yapar.

1. Depoyu `%USERPROFILE%\agy-tools` klasörüne klonla:
   ```powershell
   git clone <bu deponun adresi> "$HOME\agy-tools"
   ```
2. Klasörde Claude Code'u aç ve şunu söyle:
   > KURULUM-YONERGESI.md dosyasını oku ve uygula.

Asistan önce ön koşulları denetler (Windows, Node.js 18+, Antigravity CLI girişi). Sonra adını, kullanacağın modelleri ve ajan rollerini sorar, ayarları ona göre yapar, kancaları ekler ve duman testini çalıştırır.

Elle kurmak istersen adımlar [KURULUM-YONERGESI.md](KURULUM-YONERGESI.md) dosyasında. Örnek dosyalar `ornekler/` ve `ofis/ayarlar.ornek.json` içinde.

> Aşağıdaki model ve ajan adları varsayılan kurulumdur. Kendi modellerinle değiştirebilirsin.

## Ajanlar

| Ajan | Model | Ne için |
| --- | --- | --- |
| Argon | `gemini-4-argon-medium` / `-high` | Görsel ve tasarım (`generate_image`). Haftalık kotası sınırlı. |
| Opus | `claude-opus-5-5-high` | Zor kod işleri |
| Sonnet | `claude-sonnet-5-5-medium` | Hızlı ve basit kod işleri |

Yalnızca Argon ve Claude modelleri kullanılır; sarmalayıcı başka modeli reddeder.

## İş vermek

- **Sohbetten:** Claude Code'a söyle; işi o dağıtır (`~/.claude/CLAUDE.md` kuralları, şablon: `ornekler/CLAUDE.ornek.md`).
- **Ofisten:** sağ paneldeki **Yeni iş** sekmesi. Şablon, ajan, derinlik, klasör ve referans görsel seçilebilir.
- **Elle:**
  ```powershell
  & "$HOME\agy-tools\ask-agy.ps1" -Prompt "..." -Title "kısa ad" -WorkDir C:\proje -Model claude-sonnet-5-5-medium
  ```
  Parametreler:
  - `-PromptFile`: görevi dosyadan okur.
  - `-Mode accept-edits|plan|auto`: düzenleme onay davranışı.
  - `-Effort`: düşünme derecesi.
  - `-TimeoutSec`: zaman aşımı.
  - `-AddDir`: ajanın okuyabileceği ek klasör.
  - `-NoCopyImages`: görselleri proje klasörüne kopyalama.
  - `-AutoApprove`: tüm araç izinlerini onaylar; yalnızca git altındaki klasörlerde kullanılmalı.

Sarmalayıcının yaptıkları:
- Raporu `out/<iş>.md`, ham akışı `out/<iş>.stream.jsonl` dosyasına yazar.
- `generate_image` görsellerini proje klasörüne ve `out/<iş>/` klasörüne kopyalar.
- Aynı ajana gelen işleri sıraya koyar.

## Ekip toplantısı

Altı uzman, her biri kendi rol (skill) dosyasına göre projeyi inceler; Raportör tek bir toplu rapor yazar.

```powershell
& "$HOME\agy-tools\toplanti.ps1" -WorkDir C:\proje -Brief "Proje fikri / özeti" [-Topic "..."] [-Roles mimar,guvenlik]
```

| Rol dosyası | Ajan | Model | Odak |
| --- | --- | --- | --- |
| `ekip/roller/mimar.md` | Mimar | claude-opus-5-5-high | Yapı, katmanlar, teknoloji yığını, ölçeklenme |
| `ekip/roller/urun.md` | Ürün | claude-sonnet-5-5-medium | Hedef kitle, MVP kapsamı, başarı ölçütleri |
| `ekip/roller/tasarim.md` | Tasarım | gemini-4-argon-medium | UI/UX, tutarlılık, erişilebilirlik, görsel yön (görsel üretmez) |
| `ekip/roller/guvenlik.md` | Güvenlik | claude-opus-5-5-medium | Açıklar, gizli bilgiler, tehdit modeli |
| `ekip/roller/kalite.md` | Kalite | claude-sonnet-5-5-medium | Test kapsamı, hata yönetimi, kenar durumlar |
| `ekip/roller/devops.md` | DevOps | claude-sonnet-5-5-medium | Kurulum, yayına alma, performans, maliyet |
| `ekip/roller/raportor.md` | Raportör | claude-opus-5-5-high | Bölümleri birleştirir, önceliklendirir, çelişkileri çözer |

- Rol dosyasının üstünde `ad`, `baslik`, `model`, `sira` bilgisi, altında yönerge var. Yeni rol için aynı biçimde yeni bir `.md` dosyası yeterli.
- Uzmanlar aynı anda, salt-okuma (`-Mode plan`) kipinde çalışır.
  - Prompt'a proje dosya listesi ve "komut çalıştırma" kuralı eklenir; böylece komut izni yüzünden yarıda kalmazlar.
  - 300 karakterden kısa kalan bölüm başarısız sayılır.
- Çıktılar `out/meetings/<toplantı>/` klasöründe: özet, bölümler, sentez, rapor. Rapor ayrıca proje klasörüne `EKIP-RAPORU-<tarih>.md` olarak yazılır.
- Ofiste:
  - Uzmanlar toplantı odasına oturur, Claude ekran başında yönetir.
  - Ekran her uzmanın ilerlemesini gösterir.
  - Biten uzman kısa değerlendirmesini söyler, Raportör ekranın yanına geçer, rapor hazır olunca kutlama yapılır ve Windows bildirimi gelir.
- Ofisten başlatmak: **Yeni iş → Ekip toplantısı**. Raporlar `/rapor?yol=...` görüntüleyicisinde biçimli açılır (diyagramlar dahil, yazdır/PDF).

## Ofisten yönetim

- İş kartları:
  - Çalışan ya da sıradaki işte **İptal**; sıradaki işte **Öne al**.
  - Biten işte **Onayla** ya da **Düzeltme iste**. Düzeltme, geri bildirimle aynı ajana yeni iş olarak gider.
- Bir karaktere ya da Ekip satırına tıklayınca profil kartı açılır: işler, başarı oranı, süre, token, görseller.
- **Günü oynat:** bugünün olaylarını hızlandırılmış oynatır.
- **Ses:** iş bitince kısa bir zil çalar.
- **testleri gizle:** `test-*` projelerini akıştan, galeriden ve istatistikten saklar.
- **İstatistik sekmesi:** son 14 günde ajan başına biten işler, son 8 hafta Argon kullanımı (uyarı eşiğiyle), ajan tablosu.
- **Ayarlar:**
  - bildirimler, ofis sesleri, günlük özet saati, Argon uyarı eşiği;
  - gökyüzü, hava, mevsim süsleri;
  - karakterlerin kıyafeti, saçı ve aksesuarları;
  - **özel ajan rolleri:** ör. "Tasarımcı 2" adında ikinci bir Argon. Kendi masası olur, Yeni iş sekmesinde seçilir, `-Agent` ile de çağrılabilir.
- **Yakınlaştırma:** tekerlek ya da köşedeki düğmeler; yakınken sürükleyerek gezinilir, çift tıklama sığdırır.
- **Günü oynat:** gün ve hız (10×, 20×, 60×) seçilir.
- **Ekipteki ek Claude'lar:** aynı anda birden çok Claude Code oturumu açıksa diğerleri "Claude 2", "Claude 3" olarak boş masalara oturur.
- **Günlük özet:** ayarlardaki saatte (varsayılan 19:00) Windows bildirimi gelir ve akışa not düşer.

## Dosyalar

| Yol | Ne |
| --- | --- |
| `ask-agy.ps1` | agy sarmalayıcı: stream-json, canlı adımlar, kuyruk, görsel kopyalama, olaylar |
| `ofis-not.ps1` | Claude'un ofise not yazması (`-Type plan\|review\|approve\|reject\|note`) |
| `ofis/server.js` | Sunucu: SSE, bildirimler, iş verme/iptal/onay/kuyruk API'leri, çöken iş bekçisi, günlük özet, `/api/hook` |
| `ofis/hook-core.js` | Claude Code kanca girdisini ofis olayına çevirir (sunucu ve `hook.js` ortak) |
| `ofis/hook.js` | Yedek komut kancası (asıl yol HTTP kancası) |
| `ofis/index.html`, `ofis/static/*` | Sayfa: `scene.js` (harita, A*), `agents.js` (davranış), `draw.js` (çizim, ortam), `app.js` (olaylar, panel), `extras.js` (ayarlar, sesler, yakınlaştırma, istatistik, tarihli tekrar), `ofis.css` |
| `ofis/events.jsonl` | Tüm olaylar (8 MB'ı geçince eski kısmı `.old` dosyasına taşınır) |
| `ofis/queue/`, `ofis/locks/` | Ajan başına kuyruk ve kilit dosyaları |
| `ofis/ayarlar.json` | Ofis ayarları; `owner` alanı patronun (senin) görünen adı. Panelden düzenlenir, git'e girmez. Şablon: `ofis/ayarlar.ornek.json` |
| `ofis/ofisi-ac.cmd` | Sunucuyu başlatıp tarayıcıda açar |
| `ofis/ofis-arka-plan.vbs` | Sunucuyu penceresiz başlatır (açılışta başlasın istersen `shell:startup` klasörüne kısayolunu koy) |
| `KURULUM-YONERGESI.md` | Yapay zekâ asistanı için kurulum ve kişiselleştirme yönergesi |
| `ornekler/CLAUDE.ornek.md` | `~/.claude/CLAUDE.md` için yönetici talimatı şablonu |
| `ornekler/claude-kancalar.json` | `~/.claude/settings.json` içine birleştirilecek kancalar |
| `ofis/test-ofis.ps1` | Duman testi (ayrı portta, geçici olay dosyasıyla) |

## Claude Code kancaları

`~/.claude/settings.json` içine HTTP kancaları eklenir (`ornekler/claude-kancalar.json`): UserPromptSubmit, PreToolUse, PostToolUse(Failure), Notification ve Stop olayları `POST http://localhost:4317/api/hook` adresine gider.
- Sunucu, `Origin` başlığı taşıyan ya da JSON olmayan istekleri reddeder; böylece tarayıcıdan sahte olay gelemez.
- Ofis kapalıysa kanca sessizce başarısız olur ve Claude Code'u engellemez.

## Test

```powershell
powershell -File "$HOME\agy-tools\ofis\test-ofis.ps1"
```

## Bilinen tuzaklar

- **UTF-8:** `agy` UTF-8 yazar. PowerShell 5.1 OEM kod sayfasıyla okur, bu yüzden sarmalayıcı `[Console]::OutputEncoding` değerini UTF-8 yapar. `.ps1` dosyaları BOM'lu UTF-8 olmalı.
- **Ayrık başlatma:** node'da `spawn(..., { detached: true })` ile PowerShell bu ortamda hiç çalışmıyor; kullanma.
- **Start-Process:** PowerShell 5.1'de `Start-Process -ArgumentList` argümanları tırnaklamaz.
- **ConvertFrom-Json:** PS 5.1'de diziyi tek nesne olarak döndürür; `| ForEach-Object { $_ }` ile açılmalı.
- **Gizli sekme:** Gizli sekmede tarayıcı animasyonu durdurur. Testte `renderFrame(performance.now())` elle çağrılmalı; `frame()` çağrılmamalı, çünkü yeni bir döngü başlatır.
- **localhost:** `localhost` önce IPv6'ya gider, sunucu ise `127.0.0.1`'de dinler. Betiklerde `127.0.0.1` kullanılmalı.
- **Etkileşimsiz mod:** agy etkileşimsiz modda terminal komutlarını reddeder; iş "İzin gerekti" olarak biter.
- **Giriş:** Antigravity girişi düşerse iş "Antigravity girişi gerekli" olarak biter. Çözüm: bir terminalde `agy` çalıştırıp Google ile yeniden giriş yapmak.
