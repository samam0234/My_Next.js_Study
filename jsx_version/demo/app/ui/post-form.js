import { createPostAction, updatePostAction } from "@/app/actions/posts";
import { SubmitButton } from "@/app/ui/submit-button";

export function PostForm({ post }) {
  const action = post ? updatePostAction.bind(null, post.id) : createPostAction;

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        제목
        <input
          name="title"
          required
          defaultValue={post?.title}
          className="rounded-lg border border-line bg-white px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        본문
        <textarea
          name="body"
          required
          rows={6}
          defaultValue={post?.body}
          className="rounded-lg border border-line bg-white px-3 py-2"
        />
      </label>
      <SubmitButton label={post ? "수정" : "등록"} />
    </form>
  );
}
