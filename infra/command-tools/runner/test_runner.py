import json
import io
import threading
import sys
import unittest
from contextlib import redirect_stdout
from unittest.mock import Mock, patch
import runner


class RunnerTests(unittest.TestCase):
    def test_subfinder_finishes_before_outer_deadline(self):
        with patch.object(runner, 'run_command', return_value=(0, '{"host":"api.example.com","sources":["crtsh"]}')) as command:
            status, body = runner.run_subfinder('example.com')
        args, timeout = command.call_args.args
        self.assertEqual(status, 200)
        self.assertEqual(body['subdomains'][0]['sources'], ['crtsh'])
        self.assertIn('-cs', args)
        self.assertEqual(args[args.index('-timeout') + 1], '5')
        self.assertGreater(timeout, int(args[args.index('-max-time') + 1]) * 60)
        self.assertLess(timeout + runner.SCAN_WAIT_SECONDS, 90)

    def test_katana_limits_response_size_and_same_host(self):
        with patch.object(runner, 'run_command', return_value=(0, '{"request":{"endpoint":"https://example.com/a"}}')) as command:
            status, body = runner.run_katana('https://example.com/')
        args = command.call_args.args[0]
        self.assertEqual(status, 200)
        self.assertEqual(body['total'], 1)
        self.assertIn('-duc', args)
        self.assertEqual(args[args.index('-mrs') + 1], '1048576')
        self.assertEqual(args[args.index('-fs') + 1], 'fqdn')
        self.assertEqual(command.call_args.kwargs['max_lines'], runner.MAX_RESULTS)

    @unittest.skipIf(sys.platform == 'win32', 'Process-group termination uses the Linux Docker runtime')
    def test_streamed_output_stops_at_result_limit(self):
        code = 'import time; [print("{}", flush=True) for _ in range(1000)]; time.sleep(5)'
        with redirect_stdout(io.StringIO()):
            status, output = runner.run_command([sys.executable, '-c', code], 3, max_lines=5)
        self.assertEqual(status, 0)
        self.assertEqual(len(output.splitlines()), 5)

    def test_waits_for_scan_slot_without_increasing_concurrency(self):
        scans = Mock()
        scans.acquire.return_value = True
        waiting = threading.BoundedSemaphore(1)
        with patch.object(runner, 'SCAN_SLOTS', scans), patch.object(runner, 'WAITING_SLOTS', waiting):
            self.assertTrue(runner.acquire_scan_slot())
        scans.acquire.assert_called_once_with(timeout=runner.SCAN_WAIT_SECONDS)
        self.assertTrue(waiting.acquire(blocking=False))

    def test_queue_full_does_not_start_another_process(self):
        waiting = threading.BoundedSemaphore(1)
        waiting.acquire()
        scans = Mock()
        with patch.object(runner, 'SCAN_SLOTS', scans), patch.object(runner, 'WAITING_SLOTS', waiting):
            self.assertFalse(runner.acquire_scan_slot())
        scans.acquire.assert_not_called()

    def test_command_diagnostics_do_not_include_target_or_stderr(self):
        process = Mock(returncode=1)
        process.communicate.return_value = ('', 'secret-cookie-token')
        output = io.StringIO()
        with patch.object(runner.subprocess, 'Popen', return_value=process), redirect_stdout(output):
            runner.run_command(['katana', '-u', 'https://private-target.example/'], 5)
        log = output.getvalue()
        self.assertEqual(json.loads(log)['exitCode'], 1)
        self.assertNotIn('private-target', log)
        self.assertNotIn('secret-cookie-token', log)

    def test_nmap_unprivileged_and_curated(self):
        xml = '<nmaprun><host><status state="up"/><address addr="127.0.0.1"/><ports><port portid="8081" protocol="tcp"><state state="open"/><service name="http"/></port></ports></host></nmaprun>'
        with patch.object(runner, 'run_command', return_value=(0, xml)) as command:
            status, body = runner.run_nmap('127.0.0.1')
        self.assertEqual(status, 200)
        self.assertEqual(body['totalOpenPorts'], 1)
        self.assertIn('--unprivileged', command.call_args.args[0])
        self.assertNotIn('-sV', command.call_args.args[0])

    def test_nuclei_curates_and_restricts_execution(self):
        finding = {'template-id': 'panel', 'info': {'name': 'Panel', 'severity': 'high'}, 'request': 'secret', 'response': 'secret'}
        with patch.object(runner, 'run_command', return_value=(0, json.dumps(finding))) as command:
            status, body = runner.run_nuclei('https://example.com/')
        self.assertEqual(status, 200)
        self.assertEqual(len(body['findings']), 1)
        self.assertNotIn('secret', json.dumps(body))
        args = command.call_args.args[0]
        for flag in ['-disable-unsigned-templates', '-restrict-local-network-access', '-no-interactsh']:
            self.assertIn(flag, args)
        self.assertIn('http', args)
        self.assertEqual(command.call_args.args[1], 70)

    def test_nuclei_failure_is_not_zero_findings_success(self):
        with patch.object(runner, 'run_command', return_value=(1, '')):
            status, _ = runner.run_nuclei('https://example.com/')
        self.assertEqual(status, 502)

    def test_private_target_and_custom_arguments_rejected(self):
        for target in ['http://127.0.0.1/', 'http://192.168.15.11/', 'file:///etc/passwd']:
            with self.assertRaises(runner.InvalidRequest):
                runner.validate_request({'tool': 'nuclei', 'target': target, 'profile': 'safe'})
        with self.assertRaises(runner.InvalidRequest):
            runner.validate_request({'tool': 'nuclei', 'target': 'https://example.com/', 'profile': 'safe', 'args': '-code'})


if __name__ == '__main__':
    unittest.main()
