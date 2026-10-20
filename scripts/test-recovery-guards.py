"""Synthetic tests only: no credentials, network or backup data needed."""
import ast
from pathlib import Path
import unittest
from urllib.parse import urlparse, unquote

tree = ast.parse(Path(__file__).with_name('recovery-drill.py').read_text())
nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in ('check', 'validate_target')]
scope = {'urlparse': urlparse, 'unquote': unquote, 'TARGET': 'testtarget', 'PRODUCTION': 'production'}
exec(compile(ast.Module(body=nodes, type_ignores=[]), '<guards>', 'exec'), scope)


class SafetyGuards(unittest.TestCase):
    def test_allow_only_target(self):
        scope['validate_target']('postgresql://postgres.testtarget:synthetic@aws-0.pooler.supabase.com:5432/postgres')

    def test_reject_other_destinations(self):
        for url in [
            'postgresql://postgres.production:synthetic@aws-0.pooler.supabase.com:5432/postgres',
            'postgresql://postgres.testtarget:synthetic@attacker.example:5432/postgres',
            'postgresql://postgres.testtarget:synthetic@aws-0.pooler.supabase.com:6543/postgres',
            'postgresql://postgres.testtarget@aws-0.pooler.supabase.com:5432/postgres',
            'http://postgres.testtarget:synthetic@aws-0.pooler.supabase.com:5432/postgres',
        ]:
            with self.subTest(url=url), self.assertRaises((RuntimeError, ValueError)):
                scope['validate_target'](url)


if __name__ == '__main__':
    unittest.main()
