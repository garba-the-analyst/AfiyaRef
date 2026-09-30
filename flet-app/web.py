"""Headless-friendly web launcher (used for verification)."""
import flet as ft

from main import main

if __name__ == "__main__":
    ft.run(main, view=ft.AppView.WEB_BROWSER, port=8550)
