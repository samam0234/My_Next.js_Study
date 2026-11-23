"use client";
import { create } from "zustand";
// 서버 전역 상태에 사용자 데이터를 넣지 않는다. 이 스토어는 브라우저 초안 전용이다.
export const useDraftStore = create((set) => ({ text: "", setText: (text) => set({ text }) }));
