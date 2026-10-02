import json
import unittest
from unittest.mock import patch
import runner


class RunnerTests(unittest.TestCase):
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
