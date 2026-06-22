# -*- coding: utf-8 -*-
# Realm of Rolls - playtest launcher
# เสิร์ฟโฟลเดอร์นี้ + เปิด Cloudflare quick tunnel + ปิดหน้าต่าง = หยุดทุกอย่าง (ไม่มีโปรเซสค้าง)
import sys, os, socket, threading, subprocess, atexit, ctypes, re, http.server


def setup_job():
    """Windows Job Object: KILL_ON_JOB_CLOSE -> ลูก (cloudflared) ตายตามแม่ระดับ OS เมื่อหน้าต่างถูกปิด"""
    try:
        k32 = ctypes.windll.kernel32
        KILL_ON_JOB_CLOSE = 0x2000
        JobObjectExtendedLimitInformation = 9

        class BASIC(ctypes.Structure):
            _fields_ = [("PerProcessUserTimeLimit", ctypes.c_int64),
                        ("PerJobUserTimeLimit", ctypes.c_int64),
                        ("LimitFlags", ctypes.c_uint32),
                        ("MinimumWorkingSetSize", ctypes.c_size_t),
                        ("MaximumWorkingSetSize", ctypes.c_size_t),
                        ("ActiveProcessLimit", ctypes.c_uint32),
                        ("Affinity", ctypes.c_void_p),
                        ("PriorityClass", ctypes.c_uint32),
                        ("SchedulingClass", ctypes.c_uint32)]

        class IOC(ctypes.Structure):
            _fields_ = [("ReadOperationCount", ctypes.c_uint64),
                        ("WriteOperationCount", ctypes.c_uint64),
                        ("OtherOperationCount", ctypes.c_uint64),
                        ("ReadTransferCount", ctypes.c_uint64),
                        ("WriteTransferCount", ctypes.c_uint64),
                        ("OtherTransferCount", ctypes.c_uint64)]

        class EXT(ctypes.Structure):
            _fields_ = [("BasicLimitInformation", BASIC), ("IoInfo", IOC),
                        ("ProcessMemoryLimit", ctypes.c_size_t),
                        ("JobMemoryLimit", ctypes.c_size_t),
                        ("PeakProcessMemoryUsed", ctypes.c_size_t),
                        ("PeakJobMemoryUsed", ctypes.c_size_t)]

        k32.CreateJobObjectW.restype = ctypes.c_void_p
        k32.GetCurrentProcess.restype = ctypes.c_void_p
        k32.AssignProcessToJobObject.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
        k32.SetInformationJobObject.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_uint32]

        job = k32.CreateJobObjectW(None, None)
        info = EXT()
        info.BasicLimitInformation.LimitFlags = KILL_ON_JOB_CLOSE
        k32.SetInformationJobObject(job, JobObjectExtendedLimitInformation, ctypes.byref(info), ctypes.sizeof(info))
        k32.AssignProcessToJobObject(job, k32.GetCurrentProcess())
        return job  # ต้องถือ handle ไว้ ห้ามให้ถูก GC
    except Exception as e:
        print("[warn] job object setup failed:", e)
        return None


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    here = os.path.dirname(os.path.abspath(__file__))
    os.chdir(here)
    _job = setup_job()  # noqa: F841 (ถือ handle ไว้ตลอดอายุโปรแกรม)

    # --- หา free port ---
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()

    # --- static server (เงียบ + ทนการตัดสายของ client) ---
    class Srv(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=here, **k)

        def log_message(self, *a):
            pass

        def handle(self):
            try:
                super().handle()
            except (ConnectionError, BrokenPipeError):
                pass

        def do_POST(self):
            # รับ feedback จากในเกม -> เขียนต่อท้าย feedback.txt บนเครื่องนี้
            if self.path == "/feedback":
                try:
                    n = int(self.headers.get("Content-Length", 0))
                    data = self.rfile.read(n).decode("utf-8", errors="replace")
                    with open(os.path.join(here, "feedback.txt"), "a", encoding="utf-8") as f:
                        f.write(data + "\n")
                    print("[feedback] received %d bytes -> feedback.txt" % n)
                    self.send_response(200)
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(b"ok")
                except Exception as e:
                    print("[feedback] error:", e)
                    self.send_response(500); self.end_headers()
            else:
                self.send_response(404); self.end_headers()

    class QuietServer(http.server.ThreadingHTTPServer):
        daemon_threads = True

        def handle_error(self, request, client_address):
            pass

    httpd = QuietServer(("127.0.0.1", port), Srv)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    print("[ok] local server: http://127.0.0.1:%d" % port)

    # --- Cloudflare quick tunnel ---
    cf = os.path.join(here, "cloudflared.exe")
    logf = open(os.path.join(here, "cloudflared.log"), "w", encoding="utf-8", errors="replace")
    proc = subprocess.Popen(
        [cf, "tunnel", "--url", "http://127.0.0.1:%d" % port, "--no-autoupdate"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8", errors="replace")

    def cleanup():
        try:
            proc.terminate()
        except Exception:
            pass
    atexit.register(cleanup)

    print("\nGetting public URL (please wait ~5-15 sec)...\n")
    url = None
    pat = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")
    for line in proc.stdout:
        logf.write(line)
        logf.flush()
        if not url:
            m = pat.search(line)
            if m:
                url = m.group(0)
                bar = "=" * 54
                print(bar)
                print("  PUBLIC URL (share with your team):")
                print("     " + url)
                print(bar)
                print("\n  >> Keep this window OPEN. CLOSE it to STOP everything. <<\n")
    print("[cloudflared stopped]")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
