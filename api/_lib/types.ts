export interface VercelRequest {
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    body: any;
    query: Record<string, string | string[] | undefined>;
    socket: { remoteAddress?: string };
}

export interface VercelResponse {
    status: (statusCode: number) => VercelResponse;
    json: (body: any) => VercelResponse;
    setHeader: (name: string, value: string) => VercelResponse;
    end?: (cb?: () => void) => void;
}
