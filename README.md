# QAIP Quiz System

Repository sinkronisasi kuis dan soal ke GitHub [elanghaqeem-hash/qaipquiz](https://github.com/elanghaqeem-hash/qaipquiz).

## Fitur Auto-Sync ke GitHub
Setiap ada file baru, perubahan dokumen, atau pembaruan pada folder ini, sistem akan otomatis melakukan git add, git commit, dan git push ke GitHub origin/main.

### Cara Menjalankan Auto-Sync:
1. **Mode Background (Tanpa Jendela CMD)**:
   - Double-click file start_sync_background.vbs.
   - Script akan berjalan di latar belakang secara otomatis.
2. **Mode Konsol (Melihat log langsung di layar)**:
   - Double-click file start_sync.bat.
3. **Menghentikan Auto-Sync**:
   - Double-click file stop_sync.bat.
4. **Auto-Start saat Windows Boot/Login**:
   - Double-click file install_startup.bat.

### Git Hook:
Jika Anda melakukan git commit manual melalui Git / Terminal, hook post-commit juga akan langsung otomatis melakukan git push origin main.
