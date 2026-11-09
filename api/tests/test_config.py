from pathlib import Path

import pytest

from eventopia.config import ConfigError, load_config

API_DIR = Path(__file__).resolve().parents[1]


def test_load_config_reports_missing_keys(tmp_path):
    path = tmp_path / "config.yaml"
    path.write_text("app: {public_base_url: x}\n")
    with pytest.raises(ConfigError) as raised:
        load_config(str(path))
    assert "neo4j.uri" in str(raised.value)
    assert "telegram.bot_token" in str(raised.value)


def test_example_config_is_complete():
    config = load_config(str(API_DIR / "config.example.yaml"))
    assert config["auth"]["otp_ttl_seconds"] == 300
    assert config["auth"]["refresh_reuse_grace_seconds"] == 30
    assert config["app"]["cors_origins"] == []


@pytest.mark.parametrize("contents", ["", "[]", "app: [bad]", "app: ["])
def test_invalid_config_has_safe_error(tmp_path, contents):
    path = tmp_path / "config.yaml"
    path.write_text(contents)
    with pytest.raises(ConfigError):
        load_config(str(path))


def test_config_errors_do_not_disclose_values(tmp_path):
    path = tmp_path / "config.yaml"
    path.write_text("telegram: {bot_token: TEST_ONLY_PRIVATE_VALUE}\napp: [")
    with pytest.raises(ConfigError) as raised:
        load_config(str(path))
    assert "TEST_ONLY_PRIVATE_VALUE" not in str(raised.value)


def test_missing_config_file_has_safe_error(tmp_path):
    with pytest.raises(ConfigError):
        load_config(str(tmp_path / "missing.yaml"))
