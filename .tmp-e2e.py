import asyncio, re, time
from playwright.async_api import async_playwright
B="http://localhost:8080"
T=str(int(time.time()))[-6:]
PW="Pahari#Khagra9713"

async def signup(br, email, name, mode=None):
    ctx = await br.new_context(viewport={"width":1280,"height":1800}, permissions=["geolocation"],
                               geolocation={"latitude":23.1193,"longitude":91.9847})
    p = await ctx.new_page()
    await p.goto(B+"/auth", wait_until="domcontentloaded")
    await p.wait_for_timeout(3000)
    await p.get_by_role("tab", name="নতুন অ্যাকাউন্ট").click()
    await p.wait_for_timeout(800)
    await p.locator("#name").fill(name)
    await p.locator("#email").fill(email)
    await p.locator("#password").fill(PW)
    if mode=="driver":
        try: await p.get_by_text("চালক", exact=False).last.click()
        except Exception: pass
    await p.get_by_role("button", name="অ্যাকাউন্ট খুলুন").click()
    await p.wait_for_timeout(6000)
    if "/auth" in p.url: print("SIGNUP STUCK", (await p.inner_text("body"))[:300])
    return p

async def main():
    results=[]
    def ok(n,c): results.append((n,bool(c))); print(("PASS " if c else "FAIL ")+n)
    async with async_playwright() as pw:
        br = await pw.chromium.launch(headless=True, args=["--no-sandbox"])
        adm = await signup(br, f"admin9_{T}@chtgari.test", "টেস্ট অ্যাডমিন")
        await adm.goto(B+"/profile", wait_until="domcontentloaded"); await adm.wait_for_timeout(3500)
        try:
            await adm.get_by_role("button", name="আমাকে অ্যাডমিন করুন").click(timeout=8000)
            await adm.wait_for_timeout(3000)
        except Exception as e: print("claim:", str(e)[:150])
        await adm.goto(B+"/admin", wait_until="domcontentloaded"); await adm.wait_for_timeout(3500)
        ok("admin panel reachable", "চালক" in await adm.inner_text("body"))

        rider = await signup(br, f"rider9_{T}@chtgari.test", "টেস্ট যাত্রী")
        ok("rider signed up", "/book" in rider.url)
        drv = await signup(br, f"driver9_{T}@chtgari.test", "টেস্ট চালক", "driver")
        await drv.goto(B+"/profile", wait_until="domcontentloaded"); await drv.wait_for_timeout(3000)
        try:
            await drv.locator("#plate").fill("খাগড়াছড়ি-ল-টেস্ট")
            await drv.get_by_role("button", name=re.compile("নিবন্ধ|সংরক্ষ")).last.click()
            await drv.wait_for_timeout(3000)
            ok("driver registered", True)
        except Exception as e:
            ok("driver registered", False); print(str(e)[:150])
        await adm.reload(); await adm.wait_for_timeout(3500)
        try:
            await adm.get_by_role("button", name=re.compile("অনুমোদন")).first.click(timeout=8000)
            await adm.wait_for_timeout(2500); ok("driver approved", True)
        except Exception as e:
            ok("driver approved", False); print(str(e)[:200])

        await rider.goto(B+"/book", wait_until="domcontentloaded"); await rider.wait_for_timeout(3000)
        await rider.get_by_role("button", name="খাগড়াছড়ি বাস টার্মিনাল").first.click()
        await rider.wait_for_timeout(1500)
        await rider.get_by_role("button", name="দরদাম").click()
        await rider.get_by_label("আপনার ভাড়া").fill("80")
        await rider.wait_for_timeout(500)
        await rider.get_by_role("button", name=re.compile("রাইড নিশ্চিত করুন")).click()
        await rider.wait_for_timeout(5000)
        rb = await rider.inner_text("body")
        ok("negotiated ride created", "চালকদের প্রস্তাব" in rb)

        await drv.goto(B+"/driver", wait_until="domcontentloaded"); await drv.wait_for_timeout(3500)
        try:
            sw = drv.get_by_role("switch")
            if await sw.get_attribute("aria-checked")=="false": await sw.click(timeout=8000)
        except Exception as e: print("online:", str(e)[:150])
        await drv.wait_for_timeout(5000)
        db = await drv.inner_text("body")
        ok("driver sees the request", "যাত্রীর প্রস্তাব" in db or "গ্রহণ" in db)
        try:
            await drv.get_by_label("আপনার প্রস্তাবিত ভাড়া").first.fill("95")
            await drv.get_by_role("button", name="ভাড়া প্রস্তাব").first.click()
            await drv.wait_for_timeout(3500); ok("driver sent counter offer", True)
        except Exception as e: ok("driver sent counter offer", False); print(str(e)[:150])

        await rider.wait_for_timeout(5000)
        rb = await rider.inner_text("body")
        ok("rider sees offer 95", "৯৫" in rb)
        try:
            await rider.get_by_role("button", name="গ্রহণ").first.click(timeout=8000); await rider.wait_for_timeout(5000)
        except Exception as e: print("accept:", str(e)[:150])
        rb = await rider.inner_text("body")
        ok("ride accepted at agreed fare", "পিকআপ কোড" in rb and "৯৫" in rb)
        code_bn = ""
        try:
            box = await rider.locator("xpath=//p[normalize-space()='পিকআপ কোড']/following-sibling::p[1]").first.inner_text()
            mm = re.findall(r"[০-৯]{4}", box.replace(" ", ""))
            code_bn = mm[0] if mm else ""
        except Exception as e: print("code:", str(e)[:120])
        code = "".join(str("০১২৩৪৫৬৭৮৯".index(c)) for c in code_bn) if code_bn else ""
        print("CODE", code)
        ok("pickup code shown to rider", len(code)==4)
        ok("share + emergency bar shown", "যাত্রা শেয়ার করুন" in rb and "৯৯৯" in rb)

        await drv.reload(); await drv.wait_for_timeout(4000)
        db = await drv.inner_text("body")
        ok("driver does not see the code", bool(code) and code_bn not in db)
        await drv.get_by_role("button", name=re.compile("পৌঁছেছি")).click(); await drv.wait_for_timeout(3500)
        await drv.get_by_label("পিকআপ কোড").fill("0000" if code!="0000" else "1111")
        await drv.get_by_role("button", name=re.compile("যাত্রা শুরু")).click(); await drv.wait_for_timeout(3500)
        db = await drv.inner_text("body")
        ok("wrong code rejected", "যাত্রা শুরু" in db)
        await drv.get_by_label("পিকআপ কোড").fill(code)
        await drv.get_by_role("button", name=re.compile("যাত্রা শুরু")).click(); await drv.wait_for_timeout(4500)
        db = await drv.inner_text("body")
        ok("correct code starts the trip", "ভাড়া নিয়ে সম্পন্ন" in db)
        await drv.get_by_role("button", name=re.compile("ভাড়া নিয়ে সম্পন্ন")).click(); await drv.wait_for_timeout(4500)

        await rider.goto(B+"/rides", wait_until="domcontentloaded"); await rider.wait_for_timeout(3500)
        rb = await rider.inner_text("body")
        ok("ride in history", "সম্পন্ন" in rb)
        try:
            await rider.get_by_role("button", name=re.compile("রসিদ")).first.click(timeout=8000); await rider.wait_for_timeout(1500)
            rb = await rider.inner_text("body"); ok("receipt shows fare breakdown", "নগদ" in rb)
        except Exception as e: ok("receipt shows fare breakdown", False); print(str(e)[:150])
        try:
            await rider.get_by_role("button", name=re.compile("সমস্যা জানান")).first.click(timeout=8000); await rider.wait_for_timeout(1000)
            await rider.get_by_role("button", name=re.compile("রিপোর্ট")).last.click(); await rider.wait_for_timeout(3000)
            ok("problem report submitted", True)
        except Exception as e: ok("problem report submitted", False); print(str(e)[:150])

        print("\n%d/%d passed" % (sum(1 for _,c in results if c), len(results)))
        await br.close()
asyncio.run(main())
