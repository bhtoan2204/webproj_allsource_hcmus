import { NextResponse, type NextRequest } from 'next/server';
import { fetchRefresh } from 'src/api/auth/refresh';
import { setCookieCustom } from './utils/cookies';
import { fetchProfile } from './api/user/getProfile';
import { Socket, io } from 'socket.io-client';


export async function middleware(request: NextRequest) {
    const accessToken = request.cookies.get('accessToken');
    const refreshToken = request.cookies.get('refreshToken');
    const role = request.cookies.get('role');

    const baseURL = request.nextUrl.pathname;
    const url = request.nextUrl.clone();

    if (accessToken !== undefined) {
        const socket: Socket = io(process.env.NEXT_PUBLIC_API_HOST + '/notification', {
            extraHeaders: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
    }

    if (baseURL === '/auth/google/callback/' || baseURL === '/auth/facebook/callback/') {
        const searchParams = new URLSearchParams(request.nextUrl.search);
        const accessToken = searchParams.get('accessToken');
        const refreshToken = searchParams.get('refreshToken');
        const response = await fetchProfile(accessToken as string);
        const { role }: { role: string } = response.data;
        setCookieCustom('role', role, 100);
        const headers = [
            `accessToken=${accessToken}; Max-Age=${1 * 24 * 60 * 60}; Path=/;`,
            `refreshToken=${refreshToken}; Max-Age=${3 * 24 * 60 * 60}; Path=/;`,
            `role=${role}; Max-Age=${100}; Path=/;`,
        ];
        url.pathname = '/';
        url.search = '';

        return NextResponse.redirect(url, {
            headers: {
                'Set-Cookie': headers as any,
            },
        });
    }
    else {
        if (baseURL === '/pages/register/' && accessToken === undefined && refreshToken === undefined) {
            return NextResponse.next();
        }

        if (role === 'teacher' && baseURL.startsWith('/student/')) {
            url.pathname = '/404';

            return NextResponse.redirect(url);
        }

        if (role === 'student' && baseURL.startsWith('/teacher/')) {
            url.pathname = '/404';

            return NextResponse.redirect(url);
        }

        if (baseURL === '/pages/login/' && accessToken !== undefined && refreshToken !== undefined) {
            url.pathname = '/404';

            return NextResponse.redirect(url);
        }

        if (baseURL !== '/pages/login/' && accessToken === undefined && refreshToken === undefined) {
            url.pathname = '/pages/login/';

            return NextResponse.redirect(url);
        }

        if (accessToken === undefined && refreshToken !== undefined) {
            const response = await fetchRefresh(refreshToken);
            if (response.status === 200) {
                const setCookieHeaders = [
                    `accessToken=${response.data.accessToken}; Max-Age=${1 * 24 * 60 * 60}; Path=/;`,
                    `refreshToken=${response.data.refreshToken}; Max-Age=${3 * 24 * 60 * 60}; Path=/;`,
                ];

                return NextResponse.next({
                    headers: {
                        'Set-Cookie': setCookieHeaders as any,
                    },
                });
            } else {
                url.pathname = '/pages/login/'
                const setCookieHeaders = [
                    `refreshToken=; Max-Age=${0}; Path=/;`,
                ];

                return NextResponse.redirect(url, {
                    headers: {
                        'Set-Cookie': setCookieHeaders as any,
                    },
                });
            }
        }

        if (accessToken !== undefined && refreshToken !== undefined) {
            if (role === undefined) {
                const response = await fetchProfile(accessToken as string);
                const { role }: { role: string } = response.data;
                const headers = [
                    `role=${role}; Max-Age=${100}; Path=/;`,
                ];

                return NextResponse.next({
                    headers: {
                        'Set-Cookie': headers as any,
                    },
                });

            }
            if (role === 'null' && baseURL !== '/assign-role/') {
                url.pathname = '/assign-role/';

                return NextResponse.redirect(url);
            }
            else if (role != 'null' && baseURL === '/assign-role/') {
                url.pathname = '/';

                return NextResponse.redirect(url);
            }
        }
    }
}
export const config = {
    matcher: [
        '/page/login',
        '/',
        '/((?!api|static|.*\\..*|_next).*)'
    ],
};