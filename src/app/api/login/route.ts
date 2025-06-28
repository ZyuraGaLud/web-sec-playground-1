import { prisma } from "@/libs/prisma";
import { cookies } from "next/headers";
import { loginRequestSchema } from "@/app/_types/LoginRequest";
import type { UserProfile } from "@/app/_types/UserProfile";
import type { ApiResponse } from "@/app/_types/ApiResponse";
import { NextResponse, NextRequest } from "next/server";
import bcrypt from "bcryptjs"; // bcryptjs をインポート

// キャッシュを無効化して毎回最新情報を取得
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export const POST = async (req: NextRequest) => {
  try {
    const result = loginRequestSchema.safeParse(await req.json());
    if (!result.success) {
      const res: ApiResponse<null> = {
        success: false,
        payload: null,
        message: "リクエストボディの形式が不正です。",
      };
      return NextResponse.json(res);
    }
    const loginRequest = result.data;

    // ロックアウト情報と失敗回数も取得
    const user = await prisma.user.findUnique({
      where: { email: loginRequest.email },
      select: { id: true, email: true, name: true, role: true, password: true, failedLoginAttempts: true, lockoutUntil: true },
    });

    // ユーザーが存在しない場合、登録されていない旨を伝える
    if (!user) {
      const res: ApiResponse<null> = {
        success: false,
        payload: null,
        message: "メールアドレスまたはパスワードの組み合わせが正しくありません。", // 脆弱性対策として一般的なメッセージ
      };
      return NextResponse.json(res);
    }

    // アカウントがロックされているか確認
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
        const res: ApiResponse<null> = {
            success: false,
            payload: null,
            message: "アカウントはロックされています。しばらくしてからもう一度お試しください。",
        };
        return NextResponse.json(res);
    }

    // パスワードの検証
    const isValidPassword = await bcrypt.compare(loginRequest.password, user.password); // bcrypt でハッシュ化されたパスワードを検証

    if (!isValidPassword) {
      // ログイン失敗時の処理: 失敗回数をインクリメントし、ロックアウトを適用
      const updatedAttempts = (user.failedLoginAttempts || 0) + 1;
      let newLockoutUntil = user.lockoutUntil;
      const LOCKOUT_THRESHOLD = 3; // N回のログイン失敗でロックアウト (例: 3回)
      const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // ロックアウト期間 (例: 15分)

      if (updatedAttempts >= LOCKOUT_THRESHOLD) {
          newLockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      }
      await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: updatedAttempts, lockoutUntil: newLockoutUntil },
      });

      const res: ApiResponse<null> = {
        success: false,
        payload: null,
        message:
          "メールアドレスまたはパスワードの組み合わせが正しくありません。",
      };
      return NextResponse.json(res);
    }

    // ログイン成功時の処理: 失敗回数をリセットし、ロックアウトを解除
    await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockoutUntil: null },
    });

    // セッションIDの作成
    const sessionTokenMaxAge = 60 * 60 * 3; // 3H
    // const sessionTokenMaxAge = 60; // 1分

    // 当該ユーザのセッションが既にDBに存在するなら消す処理を入れるべき
    // await prisma.session.deleteMany({ where: { userId: user.id } });
    // ただし、これだと全ての端末のセッションが無効になる どうすればよい？
    const session = await prisma.session.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        expiresAt: new Date(Date.now() + sessionTokenMaxAge * 1000),
      },
    });

    // クッキーを設定
    const cookieStore = await cookies();
    // session_id というクッキー名が典型的すぎて狙われやすい（XSSでの標的）
    cookieStore.set("session_id", session.id, {
      path: "/", // ルートパス以下で有効
      httpOnly: true,
      sameSite: "strict",
      maxAge: sessionTokenMaxAge,
      secure: false, // secure: false は開発用。deploy 時は要切替！
    });

    const res: ApiResponse<UserProfile> = {
      success: true,
      payload: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      message: "",
    };
    return NextResponse.json(res);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Internal Server Error";
    console.error(errorMsg);
    const res: ApiResponse<null> = {
      success: false,
      payload: null,
      message: "ログインのサーバサイドの処理に失敗しました。",
    };
    return NextResponse.json(res);
  }
};