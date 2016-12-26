/* This code is placed in the public domain by camh */

#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <errno.h>

int main(int argc, char **argv)
{
        int outfd;
        char buf[1024];
        int nread;
        off_t file_length;

        if (argc != 2) {
                fprintf(stderr, "usage: %s <output_file>\n", argv[0]);
                exit(1);
        }
        if ((outfd = open(argv[1], O_WRONLY)) == -1) {
                perror("Could not open output file");
                exit(2);
        }
        while ((nread = read(0, buf, sizeof(buf))) > 0) {
                if (write(outfd, buf, nread) == -1) {
                        perror("Could not write to output file");
                        exit(4);
                }
        }
        if (nread == -1) {
                perror("Could not read from stdin");
                exit(3);
        }
        if ((file_length = lseek(outfd, 0, SEEK_CUR)) == (off_t)-1) {
                perror("Could not get file position");
                exit(5);
        }
        if (ftruncate(outfd, file_length) == -1) {
                perror("Could not truncate file");
                exit(6);
        }
        close(outfd);
        exit(0);
}