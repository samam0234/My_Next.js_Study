export type ExternalPost = {
  id: number;
  title: string;
};

export async function fetchExternalPosts(): Promise<ExternalPost[]> {
  const response = await fetch("https://jsonplaceholder.typicode.com/posts?_limit=3", {
    next: { revalidate: 60 },
  });
  if (!response.ok) {
    throw new Error("외부 API를 읽지 못했습니다.");
  }
  return response.json();
}
