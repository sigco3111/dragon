// Test-only Windows Job Object launcher; never loaded by the Worker.
// Native committed-memory and user-CPU limits, NOT RSS or permission isolation.
// References: Microsoft Learn Job Objects and JOBOBJECT_*_LIMIT_INFORMATION.
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class PortraitJobProbe {
    const uint Flags = 0x4 | 0x100 | 0x200 | 0x2000; // JOB_TIME, PROCESS_MEMORY, JOB_MEMORY, KILL_ON_JOB_CLOSE
    [StructLayout(LayoutKind.Sequential)] struct Basic {
        public long ProcessUserTime, JobUserTime;
        public uint LimitFlags;
        public UIntPtr MinWorkingSet, MaxWorkingSet;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)] struct Io {
        public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes;
    }
    [StructLayout(LayoutKind.Sequential)] struct Extended {
        public Basic Basic;
        public Io Io;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }
    [StructLayout(LayoutKind.Sequential)] struct Accounting {
        public long TotalUserTime, TotalKernelTime, ThisPeriodUserTime, ThisPeriodKernelTime;
        public uint PageFaults, TotalProcesses, ActiveProcesses, TerminatedProcesses;
    }
    [StructLayout(LayoutKind.Sequential)] struct Security {
        public uint Length;
        public IntPtr Descriptor;
        [MarshalAs(UnmanagedType.Bool)] public bool Inherit;
    }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct Startup {
        public uint Size;
        public string Reserved, Desktop, Title;
        public uint X, Y, Width, Height, CountX, CountY, FillAttribute, Flags;
        public ushort ShowWindow, ReservedBytes;
        public IntPtr ReservedPointer, Input, Output, Error;
    }
    [StructLayout(LayoutKind.Sequential)] struct ProcessInfo {
        public IntPtr Process, Thread;
        public uint ProcessId, ThreadId;
    }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr security, string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int type, ref Extended info, uint size);
    [DllImport("kernel32.dll", EntryPoint="QueryInformationJobObject", SetLastError=true)] static extern bool QueryLimits(IntPtr job, int type, out Extended info, uint size, IntPtr length);
    [DllImport("kernel32.dll", EntryPoint="QueryInformationJobObject", SetLastError=true)] static extern bool QueryAccounting(IntPtr job, int type, out Accounting info, uint size, IntPtr length);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint code);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateFile(string path, uint access, uint share, ref Security security, uint creation, uint flags, IntPtr template);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string application, StringBuilder command, IntPtr processSecurity, IntPtr threadSecurity, bool inherit, uint flags, IntPtr environment, string directory, ref Startup startup, out ProcessInfo process);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process, uint code);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    static void Require(bool condition, string action) { if (!condition) throw new Win32Exception(Marshal.GetLastWin32Error(), action); }
    static bool Valid(IntPtr handle) { return handle != IntPtr.Zero && handle != new IntPtr(-1); }
    static void Close(IntPtr handle) { if (Valid(handle)) CloseHandle(handle); }
    static string Quote(string value) {
        if (value.IndexOf('"') >= 0 || value.EndsWith("\\")) throw new ArgumentException("Invalid probe path");
        return "\"" + value + "\"";
    }
    public static Dictionary<string, object> Run(string node, string child, string input, string output, string error, string directory, ulong memoryBytes, int cpuSeconds, int wallMs) {
        // Experimental limits, not an approved production SLA or input budget.
        if (memoryBytes < 64UL*1024*1024 || memoryBytes > 512UL*1024*1024 || cpuSeconds < 1 || cpuSeconds > 10 || wallMs < 500 || wallMs > 30000) throw new ArgumentException("Invalid probe limits");
        IntPtr job=IntPtr.Zero, stdin=IntPtr.Zero, stdout=IntPtr.Zero, stderr=IntPtr.Zero, env=IntPtr.Zero;
        ProcessInfo process = new ProcessInfo();
        bool finished=false;
        try {
            job=CreateJobObject(IntPtr.Zero, null); Require(Valid(job), "CreateJobObject");
            var limit=new Extended(); limit.Basic.LimitFlags=Flags; limit.Basic.JobUserTime=cpuSeconds*10000000L;
            limit.ProcessMemory=new UIntPtr(memoryBytes); limit.JobMemory=new UIntPtr(memoryBytes);
            Require(SetInformationJobObject(job, 9, ref limit, (uint)Marshal.SizeOf<Extended>()), "SetInformationJobObject");
            Extended observed;
            Require(QueryLimits(job, 9, out observed, (uint)Marshal.SizeOf<Extended>(), IntPtr.Zero), "Query limits");
            if (observed.Basic.LimitFlags != Flags || observed.JobMemory.ToUInt64() != memoryBytes || observed.ProcessMemory.ToUInt64() != memoryBytes || observed.Basic.JobUserTime != cpuSeconds*10000000L) throw new InvalidOperationException("Limits did not round-trip");
            var security=new Security { Length=(uint)Marshal.SizeOf<Security>(), Inherit=true };
            stdin=CreateFile(input, 0x80000000, 1, ref security, 3, 0x80, IntPtr.Zero); Require(Valid(stdin), "Open input");
            stdout=CreateFile(output, 0x40000000, 1, ref security, 1, 0x80, IntPtr.Zero); Require(Valid(stdout), "Create stdout");
            stderr=CreateFile(error, 0x40000000, 1, ref security, 1, 0x80, IntPtr.Zero); Require(Valid(stderr), "Create stderr");
            // Only necessary Windows environment, no credentials or NODE_OPTIONS.
            var values=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);
            foreach (string key in new[]{"SystemRoot","windir","TEMP","TMP","PATH"}) {
                var value=Environment.GetEnvironmentVariable(key); if (value!=null) values[key]=value;
            }
            var block=new StringBuilder(); foreach(var item in values) block.Append(item.Key+"="+item.Value+'\0'); block.Append('\0');
            env=Marshal.StringToHGlobalUni(block.ToString());
            var startup=new Startup { Size=(uint)Marshal.SizeOf<Startup>(), Flags=0x100, Input=stdin, Output=stdout, Error=stderr };
            Require(CreateProcess(node, new StringBuilder(Quote(node)+" "+Quote(child)), IntPtr.Zero, IntPtr.Zero, true, 0x08000404, env, directory, ref startup, out process), "CreateProcess suspended");
            // There is no running-before-assignment window and no breakaway flag.
            Require(AssignProcessToJobObject(job, process.Process), "AssignProcessToJobObject");
            Require(ResumeThread(process.Thread)!=uint.MaxValue, "ResumeThread");
            var timer=Stopwatch.StartNew();
            uint wait=WaitForSingleObject(process.Process, (uint)wallMs);
            bool wallKilled=wait==0x102;
            if (wallKilled) { Require(TerminateJobObject(job, 0xE001), "Wall terminate job"); Require(WaitForSingleObject(process.Process, 5000)==0, "Wait after wall kill"); }
            else Require(wait==0, "Wait for child");
            uint exit; Require(GetExitCodeProcess(process.Process, out exit), "Read exit");
            Accounting before; Require(QueryAccounting(job, 1, out before, (uint)Marshal.SizeOf<Accounting>(), IntPtr.Zero), "Read accounting");
            // A parent may exit while descendants remain. Explicitly clear the
            // whole owned job and verify zero active processes before reporting.
            Require(TerminateJobObject(job, 0xE002), "Cleanup job");
            Accounting after=new Accounting();
            for (int i=0;i<100;i++) {
                Require(QueryAccounting(job, 1, out after, (uint)Marshal.SizeOf<Accounting>(), IntPtr.Zero), "Read final accounting");
                if (after.ActiveProcesses==0) break; Thread.Sleep(20);
            }
            if(after.ActiveProcesses!=0) throw new InvalidOperationException("Job processes survived cleanup");
            Extended peak; Require(QueryLimits(job, 9, out peak, (uint)Marshal.SizeOf<Extended>(), IntPtr.Zero), "Read peaks");
            finished=true;
            return new Dictionary<string,object> {
                {"pid",process.ProcessId},{"limitFlags",observed.Basic.LimitFlags},{"memoryBytes",memoryBytes},{"cpuSeconds",cpuSeconds},{"wallMs",wallMs},
                {"assignedBeforeResume",true},{"wallKilled",wallKilled},{"exitCode",exit},{"elapsedMs",timer.ElapsedMilliseconds},
                {"peakProcessCommitBytes",peak.PeakProcessMemory.ToUInt64()},{"peakJobCommitBytes",peak.PeakJobMemory.ToUInt64()},
                {"userCpu100ns",after.TotalUserTime},{"kernelCpu100ns",after.TotalKernelTime},{"totalProcesses",after.TotalProcesses},
                {"activeBeforeCleanup",before.ActiveProcesses},{"activeAfterCleanup",after.ActiveProcesses},
                {"rssHardCap",false},{"permissionSandbox",false},{"productionInstalled",false}
            };
        } finally {
            // Fail closed even if assignment/query/resume failed; never run an
            // uncontained replacement. All handles belong to this probe only.
            if(!finished) { if(Valid(job)) TerminateJobObject(job, 0xE003); if(Valid(process.Process)) { TerminateProcess(process.Process, 0xE003); WaitForSingleObject(process.Process, 5000); } }
            Close(process.Thread); Close(process.Process); Close(stderr); Close(stdout); Close(stdin); Close(job);
            if(env!=IntPtr.Zero) Marshal.FreeHGlobal(env);
        }
    }
}
