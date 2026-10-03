# Hợp đồng JSON Speaking (nhập kết quả Speaking bằng JSON)

Dùng ở **bước 6 (Speaking)** của app chấm phiếu, ô **"Nhập Speaking bằng JSON"**. Cách này dùng **song song** với quét phiếu Speaking và nhập tay: học sinh nào có kết quả bằng cách nào cũng vào cùng một chỗ, vào cùng phiếu báo điểm và cùng file Excel, CSV, Google Sheet.

## 1. Cách dùng

1. Mở bước **Speaking**, dán JSON vào khung (hoặc bấm **Tải file .json lên**, chọn được nhiều file một lúc).
2. Bấm **Kiểm tra và lưu**. App báo từng học sinh: đã lưu (kèm điểm /tổng và điểm thang) hoặc chưa lưu và lý do.
3. Học sinh đã có kết quả Speaking (từ quét hoặc nhập tay) thì app hỏi **có ghi đè không**.

## 2. Cấu trúc một học sinh

```json
{
  "schema_version": "1.0",
  "level": "PET",
  "student": { "id": "C260159XX", "name": "Tên học sinh" },
  "bands": { "GV": 3, "DM": 3, "P": 2, "IC": 4, "GA": 3 },
  "evidence": ["G-S • developing", "P-I • effortful"],
  "weak_part": "P3"
}
```

| Trường | Bắt buộc | Ý nghĩa |
|---|---|---|
| `level` | Không | `KET`, `PET` hoặc `FCE`. Nếu có thì **phải đúng cấp độ của lớp đang chấm** |
| `student.id` | **Có** | Mã học sinh. Nhận cả dạng đầy đủ (`C260159XX`) và 6 chữ số (`260159`). Có thể viết `"student": "C260159XX"` |
| `student.name` | Không | Chỉ để người đọc, app lấy tên theo danh sách lớp |
| `bands` | **Có** | Band từng tiêu chí, **số nguyên từ 1 đến 5**. Phải đủ mọi tiêu chí của cấp độ (xem mục 3) |
| `evidence` | Không | Danh sách **mã chẩn đoán** giám khảo tick trên phiếu (xem mục 4). Để `[]` thì phiếu báo điểm không có nhận xét Speaking chi tiết |
| `weak_part` | Không | Part yếu nhất ("Notably weak part"): `P1` đến `P4` (KET chỉ có `P1`, `P2`). Bỏ trống hoặc `"none"` nếu không có |

Cũng nhận **nhiều học sinh** trong một file: một mảng `[ {...}, {...} ]` hoặc `{ "students": [ {...}, {...} ] }`.

## 3. Tiêu chí và cách tính điểm

| Cấp độ | Tiêu chí (khoá trong `bands`) | Công thức điểm thô |
|---|---|---|
| PET | GV, DM, P, IC, GA (5 tiêu chí) | GV×1 + DM×1 + P×1 + IC×1 + GA×2 = /30 |
| KET | GV, P, IC, GA (4 tiêu chí, không có DM) | GV×2 + P×2 + IC×2 + GA×3 = /45 |
| FCE | GV, DM, P, IC, GA (5 tiêu chí) | (GV + DM + P + IC)×2 + GA×4 = /60 |

Khoá: **GV** Grammar & Vocabulary, **DM** Discourse Management, **P** Pronunciation, **IC** Interactive Communication, **GA** Global Achievement. Điểm thang Cambridge lấy từ bảng quy đổi chính thức của trường.

## 4. Mã chẩn đoán (`evidence`)

Mỗi mã có dạng `"MÃ • trạng thái"` (dấu giữa là dấu chấm tròn •). **Phải đúng từng chữ** như trong bảng dưới (khoảng trắng hai bên dấu • không quan trọng). Mã sai hoặc không có trong bộ nhận xét bị **bỏ qua** và app báo lại, **không** làm hỏng việc lưu band.

### PET

| Mã | Trạng thái được chọn |
|---|---|
| `G-S` | `secure` · `developing` · `priority` |
| `G-C` | `evidence present` · `little/no evidence` |
| `G-R` | `recurring pattern` |
| `V-R` | `strong` · `adequate` · `limited` |
| `V-A` | `appropriate` · `mixed / inconsistent` · `frequent issues` |
| `DM-E` | `sustained` · `developed` · `mostly short` |
| `DM-D/R` | `strong` · `adequate` · `limited / repetitive` |
| `DM-C` | `varied links` · `basic links` · `weak / isolated` |
| `DM-H` | `little impact` · `some impact` · `disrupts ideas` |
| `P-I` | `clear / easy` · `mostly clear` · `effortful` |
| `P-W` | `accurate` · `some errors` · `frequent errors` |
| `P-S/IN` | `effective` · `some control` · `limited` |
| `P-SND` | `generally clear` · `occasional issues` · `recurring issues` |
| `I` | `observed` · `absent/weak` |
| `R` | `observed` · `weak` |
| `D` | `observed` · `weak` |
| `Q` | `observed` · `absent` |
| `N` | `observed` · `absent` |
| `Independence` | `independent` · `occasional support` · `frequent support` |
| `Interaction quality` | `develops exchange` · `keeps it going` · `mostly reactive` |
| `Whole-test handling` | `independent` · `generally successful` · `inconsistent / support needed` |
| `Extended communication` | `sustained` · `adequate` · `difficult to maintain` |

### KET

| Mã | Trạng thái được chọn |
|---|---|
| `G-S` | `secure` · `developing` · `priority` |
| `G-R` | `tense` · `agreement` · `articles/prepositions` · `word order/question form` |
| `V-R` | `strong` · `adequate` · `limited` |
| `V-A` | `appropriate` · `mixed/frequent issues` |
| `P-I` | `clear/easy` · `mostly clear` · `effortful` |
| `P-W` | `mostly accurate` · `some/frequent errors` |
| `P-S/IN` | `some effective control` · `limited` |
| `P-SND` | `generally clear` · `occasional/recurring issues` |
| `I` | `initiate observed` · `weak/absent` |
| `R` | `respond observed` · `weak` |
| `A` | `add observed` · `weak` |
| `Q` | `ask observed` · `weak/absent` |
| `F` | `follow-up observed` |
| `Support` | `very little` · `some` · `frequent/additional` |
| `Exchange quality` | `maintains naturally` · `keeps exchange going` · `mostly reactive/difficult` |
| `GA-WH` | `effective/independent` · `basic but successful` · `inconsistent/support needed` |
| `GA-L` | `longer utterances` · `short sentences/phrases` · `isolated words/phrases` |
| `GA-H` | `manageable` · `frequent but continues` · `blocks message` |

### FCE

| Mã | Trạng thái được chọn |
|---|---|
| `G-S` | `secure` · `developing/priority` |
| `G-C` | `varied + controlled` · `some successful` · `limited/unreliable` |
| `Complex evidence` | `TC/REL/COND/MOD/SUB/PASS/VP` |
| `G-R` | `recurring error` · `complex breakdown` |
| `V-R` | `broad for familiar topics` · `adequate B2` · `repetitive/limited` |
| `V-A` | `precise/appropriate` · `generally appropriate` · `mixed/frequent issues` |
| `Lexical evidence` | `paraphrase/chunks` |
| `DM-E` | `sustained` · `extended but uneven` · `short/restricted` |
| `DM-D/R` | `developed + relevant` · `adequate` · `limited/repetitive` |
| `DM-C` | `varied + clear organisation` · `range of links` · `basic/weak` |
| `DM-H` | `very little impact` · `some impact` · `disrupts flow` |
| `P-I` | `clear/effortless` · `clear overall` · `listener effort` |
| `P-W` | `accurate/generally accurate` · `recurring errors` |
| `P-S/IN` | `effective/appropriate` · `generally controlled` · `limited/inconsistent` |
| `P-SND` | `clear/generally clear` · `recurring issues` |
| `I` | `observed` · `weak` |
| `R` | `observed` · `weak` |
| `L` | `observed` · `absent/weak` |
| `D` | `observed` · `weak` |
| `Q` | `observed` · `weak` |
| `N` | `observed` · `weak` |
| `Independence` | `independent/very little support` · `needs support` |
| `Interaction quality` | `builds collaborative exchange` · `maintains/develops` · `separate/reactive` |
| `GA-WH` | `secure/independent B2` · `generally successful` · `uneven/support needed` |
| `GA-ED` | `coherent + sustained` · `organised but uneven` · `difficult to sustain` |
| `GA-LR` | `accurate + appropriate` · `generally adequate` · `frequent limitations` |

## 5. Lỗi thường gặp

| Thông báo | Cách sửa |
|---|---|
| mã học sinh "…" không có trong lớp … | Kiểm tra mã; học sinh phải thuộc **lớp đang chấm** |
| band … phải là số nguyên từ 1 đến 5 | Ghi số 1 đến 5, **không** để trong dấu ngoặc kép |
| JSON này là cấp độ … | File của cấp độ khác; chọn đúng lớp và đề ở bước 1 |
| mã chẩn đoán "…" không có trong bộ nhận xét | Sao chép đúng mã trong mục 4 |
| không đọc được JSON | Thiếu hoặc thừa dấu phẩy, ngoặc, hoặc dùng dấu nháy cong " " thay cho " " |

## 6. File mẫu

`mau-speaking-pet.json`, `mau-speaking-ket.json`, `mau-speaking-fce.json` (đổi `student.id` thành mã học sinh thật trước khi dùng).
