# Foreground-only bridge for viewing the isolated synthetic QA preview from one Mac.
# Usage: ssh -L 127.0.0.1:4177:127.0.0.1:14177 <preview> "python3 -u - <container>" < live-bridge.py
# Ends with the SSH session; writes no files on the server and publishes no port.
import os, socket, subprocess, sys, threading

CONTAINER = sys.argv[1] if len(sys.argv) > 1 else "sitrep-qa-live-20261017"
PERL_PIPE = r'''
use strict; use IO::Socket::INET; use IO::Select;
my $s = IO::Socket::INET->new(PeerAddr => "127.0.0.1", PeerPort => 4177) or exit 1;
binmode STDIN; binmode STDOUT;
my $sel = IO::Select->new(\*STDIN, $s);
while (my @ready = $sel->can_read) {
  for my $h (@ready) {
    my $n = sysread($h, my $buf, 65536);
    if (!$n) { exit 0 if fileno($h) == fileno($s); $sel->remove(\*STDIN); shutdown($s, 1); next; }
    if (fileno($h) == fileno($s)) { syswrite(STDOUT, $buf) } else { syswrite($s, $buf) }
  }
}
'''


def handle(conn):
    proc = subprocess.Popen(["docker", "exec", "-i", "-u", "1000", CONTAINER, "perl", "-e", PERL_PIPE],
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE, bufsize=0)

    def upstream():
        try:
            while True:
                data = conn.recv(65536)
                if not data:
                    break
                proc.stdin.write(data)
        except OSError:
            pass
        finally:
            try:
                proc.stdin.close()
            except OSError:
                pass

    threading.Thread(target=upstream, daemon=True).start()
    try:
        while True:
            data = os.read(proc.stdout.fileno(), 65536)
            if not data:
                break
            conn.sendall(data)
    except OSError:
        pass
    finally:
        conn.close()
        proc.kill()
        proc.wait()


server = socket.socket()
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind(("127.0.0.1", 14177))
server.listen(32)
print("bridge ready", flush=True)
while True:
    client, _ = server.accept()
    threading.Thread(target=handle, args=(client,), daemon=True).start()
