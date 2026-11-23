"use client";
import { useState } from "react";
// 첫 렌더는 서버와 동일한 빈 문자열. localStorage는 클릭 이벤트에서만 읽는다.
export function Draft() {
    const [draft, setDraft] = useState(""), [status, setStatus] = useState("");
    function save() {
        try {
            localStorage.setItem("next-study-draft", draft);
            setStatus("저장했습니다.");
        }
        catch {
            setStatus("브라우저 저장 공간을 사용할 수 없습니다.");
        }
    }
    function load() {
        try {
            setDraft(localStorage.getItem("next-study-draft") ?? "");
            setStatus("불러왔습니다.");
        }
        catch {
            setStatus("불러오기에 실패했습니다.");
        }
    }
    return (<section>
      <h2>초안</h2>
      <textarea aria-label="초안" value={draft} onChange={(e) => setDraft(e.target.value)}/>
      <button onClick={save}>로컬 저장</button>
      <button onClick={load}>불러오기</button>
      <p role="status">{status}</p>
    </section>);
}
