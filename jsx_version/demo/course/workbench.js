"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import * as Dialog from "@radix-ui/react-dialog";
import { useDraftStore } from "./ui-store";
import { api } from "./client";
export function Workbench() {
    const { register, handleSubmit, formState: { errors, isSubmitting }, } = useForm();
    const text = useDraftStore((s) => s.text), setText = useDraftStore((s) => s.setText);
    const [answer, setAnswer] = useState(""), [message, setMessage] = useState(""), [jobs, setJobs] = useState("알림 연결 대기");
    const controller = useRef(null);
    useEffect(() => {
        const events = new EventSource("/api/events");
        events.onmessage = (e) => setJobs(e.data);
        events.onerror = () => setJobs("로그인 여부와 네트워크를 확인하세요.");
        return () => {
            events.close();
            controller.current?.abort();
        };
    }, []);
    async function summarize(values) {
        setAnswer("");
        setMessage("");
        const abort = new AbortController();
        controller.current = abort;
        try {
            const response = await fetch("/api/ai/summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, question: values.question }),
                signal: abort.signal,
            });
            if (!response.ok)
                throw new Error((await response.json()).error.message);
            const reader = response.body.getReader(), decoder = new TextDecoder();
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done)
                        break;
                    setAnswer((previous) => previous + decoder.decode(value, { stream: true }));
                }
                setAnswer((previous) => previous + decoder.decode());
            }
            finally {
                reader.releaseLock();
            }
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "스트림 오류");
        }
        finally {
            controller.current = null;
        }
    }
    async function act(fn) {
        try {
            const value = await fn();
            setMessage(JSON.stringify(value));
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "실패");
        }
    }
    return (<section className="course">
      <h1>문서·AI 작업실</h1>
      <a href="/board">게시판·로그인</a>
      <label>
        문서 내용
        <textarea value={text} maxLength={20_000} onChange={(e) => setText(e.target.value)}/>
      </label>
      <label>
        txt/md 불러오기
        <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file)
                return;
            if (file.size > 20_000) {
                setMessage("파일은 20KB까지입니다.");
                return;
            }
            void act(async () => {
                const content = await file.text();
                setText(content);
                return api("/api/files", "POST", {
                    name: file.name,
                    text: content,
                });
            });
        }}/>
      </label>
      <form onSubmit={(event) => {
            void handleSubmit(summarize)(event);
        }}>
        <label>
          질문
          <input {...register("question", {
        required: "질문을 입력하세요.",
        maxLength: { value: 1000, message: "1000자까지입니다." },
    })} defaultValue="핵심을 세 문장으로 요약해 주세요."/>
        </label>
        <p role="alert">{errors.question?.message}</p>
        <button disabled={isSubmitting || !text.trim()}>요약·질문</button>
        <button type="button" onClick={() => controller.current?.abort()}>
          생성 취소
        </button>
      </form>
      <pre aria-live="polite" style={{ whiteSpace: "pre-wrap" }}>
        {answer}
      </pre>
      <p role="status">{message}</p>
      <button onClick={() => act(() => api("/api/jobs", "POST", { text }))}>
        텍스트 처리 작업 예약
      </button>
      <p>내 작업 알림: {jobs}</p>
      <button onClick={() => act(() => fetch("/api/mail", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": crypto.randomUUID(),
            },
            body: JSON.stringify({ text: answer || text }),
        }).then(async (response) => {
            const body = await response.json();
            if (!response.ok)
                throw new Error(body.error.message);
            return body;
        }))}>
        내 이메일로 보내기
      </button>
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button>테스트 결제 안내</button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay style={{ position: "fixed", inset: 0, background: "#0008" }}/>
          <Dialog.Content style={{
            position: "fixed",
            inset: "20% 10% auto",
            padding: 24,
            background: "white",
            color: "#111",
        }}>
            <Dialog.Title>Stripe 테스트 결제</Dialog.Title>
            <Dialog.Description>
              테스트 키로 만든 결제 세션으로 이동합니다. 카드 번호는 테스트
              카드만 입력하세요. 돌아온 URL은 결제 성공의 증거가 아닙니다.
            </Dialog.Description>
            <button onClick={() => act(async () => {
            const response = await fetch("/api/payments/checkout", {
                method: "POST",
                headers: { "Idempotency-Key": crypto.randomUUID() },
            });
            const body = await response.json();
            if (!response.ok)
                throw new Error(body.error.message);
            if (new URL(body.data.url).hostname !== "checkout.stripe.com")
                throw new Error("결제 주소 오류");
            window.location.assign(body.data.url);
        })}>
              테스트 세션 생성
            </button>
            <Dialog.Close asChild>
              <button>닫기</button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>);
}
