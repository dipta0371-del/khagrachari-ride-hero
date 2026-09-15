import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMe, type MeData } from "@/lib/rides.functions";

export function useMe() {
  const fn = useServerFn(getMe);
  return useQuery<MeData>({
    queryKey: ["me"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });
}
